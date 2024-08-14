export async function loadFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  expect(response.ok).toBeTrue();
  const blob = await response.blob();
  return new File([blob], filename);
}
