export async function data(params: {id: string}) {
  // This works only for local dev case.
  return (
    await fetch(`http://localhost:8000/data/item${params.id}.json`)
  ).json();
}
