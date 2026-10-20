// Renaming in place: `start` opens the field, `finish` (enter, escape or blur) closes it and saves a
// changed name; an empty name restores the old one.
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
