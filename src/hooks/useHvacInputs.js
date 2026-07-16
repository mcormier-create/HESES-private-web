import { useState } from 'react'

export function useHvacInput(initialValue) {
  const [value, setValue] = useState(initialValue)
  const update = (nextValue) => setValue(Number(nextValue))

  return [value, update]
}
