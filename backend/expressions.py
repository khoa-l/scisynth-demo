"""A typed `lambda x, y: ...` turned into the function of an AnalyticField.

The text comes from the browser, so it is never passed to `eval` as it is. It is parsed, checked
against a short list of what it may contain (arithmetic, comparisons, the lambda's own arguments, a
few numpy functions and constants) and only then compiled, with no builtins. This keeps typos and
stray requests from running anything but math; it is not a sandbox for hostile users."""

import ast
from collections.abc import Callable
from typing import Any

import numpy as np

MAX_LENGTH = 300

# usable by name (`sin(x)`) or as `np.sin(x)`
FUNCTIONS = {
    name: getattr(np, name)
    for name in (
        "sin cos tan arcsin arccos arctan arctan2 sinh cosh tanh exp log log10 sqrt abs sign floor "
        "ceil hypot minimum maximum where clip"
    ).split()
}
CONSTANTS = {"pi": np.pi, "e": np.e}

OPERATORS = (
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow, ast.BitAnd, ast.BitOr,
    ast.USub, ast.UAdd, ast.Invert, ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Eq, ast.NotEq,
)  # fmt: skip


class _Checked(ast.NodeTransformer):
    """Rejects anything outside the allowed list; whole numbers become floats, so `9 ** 9 ** 9`
    overflows at once instead of building a huge integer."""

    def __init__(self, arguments: set[str]) -> None:
        self.arguments = arguments

    def generic_visit(self, node: ast.AST) -> ast.AST:
        if not isinstance(
            node,
            (ast.BinOp, ast.UnaryOp, ast.Compare, ast.Call, ast.keyword, ast.Load, *OPERATORS),
        ):
            raise ValueError(f"{type(node).__name__} is not allowed in the expression")
        return super().generic_visit(node)

    def visit_Constant(self, node: ast.Constant) -> ast.AST:
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise ValueError("Only numbers are allowed in the expression")
        return ast.copy_location(ast.Constant(float(node.value)), node)

    def visit_Name(self, node: ast.Name) -> ast.AST:
        if node.id not in self.arguments | FUNCTIONS.keys() | CONSTANTS.keys():
            raise ValueError(f"Unknown name {node.id!r}")
        return node

    def visit_Attribute(self, node: ast.Attribute) -> ast.AST:
        if not (isinstance(node.value, ast.Name) and node.value.id == "np"):
            raise ValueError("Only np.<function> is allowed")
        if node.attr not in FUNCTIONS and node.attr not in CONSTANTS:
            raise ValueError(f"np.{node.attr} is not allowed")
        return node

    def visit_Call(self, node: ast.Call) -> ast.AST:
        # the called thing must be a plain function name, or np.<function>
        function = node.func
        name = function.attr if isinstance(function, ast.Attribute) else getattr(function, "id", "")
        if name not in FUNCTIONS or (isinstance(function, ast.Name) and function.id in self.arguments):
            raise ValueError("Only the listed functions can be called")
        if any(k.arg is None for k in node.keywords):
            raise ValueError("Only the listed functions can be called")
        self.visit(function)
        node.args = [self.visit(a) for a in node.args]
        node.keywords = [self.visit(k) for k in node.keywords]
        return node


def lambda_function(source: str, ndim: int) -> Callable[..., Any]:
    """The function of ``lambda x, y: ...``, taking one array per axis (``ndim`` of them).

    Raises ``ValueError`` if the text is not such a lambda or uses anything not allowed. The
    function checks that every value it returns is finite, since JSON cannot carry the rest."""
    if len(source) > MAX_LENGTH:
        raise ValueError(f"The expression is longer than {MAX_LENGTH} characters")
    try:
        tree = ast.parse(source.strip(), mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"Not valid Python: {exc.msg}") from None
    node = tree.body
    if not isinstance(node, ast.Lambda):
        raise ValueError("Write a lambda, such as: lambda x, y: 0.1 * x")
    args = node.args
    if args.vararg or args.kwarg or args.kwonlyargs or args.defaults or args.posonlyargs:
        raise ValueError("The lambda takes plain arguments only")
    names = [a.arg for a in args.args]
    if len(names) != ndim:
        raise ValueError(f"The lambda takes {len(names)} arguments; the domain has {ndim} axes")
    body = _Checked(set(names)).visit(node.body)
    tree.body = ast.Lambda(args=args, body=body)
    ast.fix_missing_locations(tree)
    scope = {"__builtins__": {}, "np": np, **FUNCTIONS, **CONSTANTS}
    function = eval(compile(tree, "<expression>", "eval"), scope)  # noqa: S307 (checked above)

    def finite(*axes: Any) -> Any:
        try:
            out = function(*axes)
        except ArithmeticError as exc:  # overflow, or a division of plain numbers by zero
            raise ValueError(f"The expression failed: {exc}") from None
        if not np.all(np.isfinite(out)):
            raise ValueError("The expression gave a value that is not finite")
        return out

    return finite
