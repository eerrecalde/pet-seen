const dogBreeds = ['Border collie', 'Cocker spaniel', 'French bulldog', 'German shepherd', 'Golden retriever', 'Jack Russell terrier', 'Labrador retriever']
const catBreeds = ['British Shorthair', 'Bengal', 'Maine Coon', 'Persian', 'Ragdoll', 'Siamese', 'Domestic shorthair']
const markings = ['Black', 'Black and white', 'Ginger', 'Tabby', 'Tortoiseshell', 'White', 'Gray']
const specialValues = ['Unknown', 'Mixed', 'Other']

/**
 * A datalist keeps entry flexible while gently steering people to values the
 * matcher can compare reliably. The chosen text is still stored verbatim.
 */
export function PetAttributeSuggestions({ id, species }: { id: string, species: 'dog' | 'cat' }) {
  const choices = species === 'dog' ? dogBreeds : catBreeds

  return <>
    <datalist id={`${id}-breed`}>
      {choices.map((breed) => <option key={breed} value={breed} />)}
      {specialValues.map((value) => <option key={value} value={value} />)}
    </datalist>
    <datalist id={`${id}-colour`}>
      {markings.map((marking) => <option key={marking} value={marking} />)}
      {specialValues.map((value) => <option key={value} value={value} />)}
    </datalist>
  </>
}
