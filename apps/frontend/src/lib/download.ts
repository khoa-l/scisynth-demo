export function download(file: Blob, name: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
