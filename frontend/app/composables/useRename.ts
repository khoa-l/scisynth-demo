// Renaming an item in place (a study, a task): `start` opens the field, `finish` (enter, escape or
// leaving the field) closes it and saves a changed name. An empty name is not kept: the old one
// comes back.
export function useRename(item: { name: string }, save: () => Promise<unknown>) {
  const editing = ref(false);
  let before = "";

  function start() {
    before = item.name;
    editing.value = true;
  }

  async function finish() {
    if (!editing.value) return;
    editing.value = false;
    if (!item.name.trim()) item.name = before;
    else if (item.name !== before) await save();
  }

  return { editing, start, finish };
}
