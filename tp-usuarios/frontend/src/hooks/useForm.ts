import { useState, ChangeEvent } from 'react';

// Hook personalizado para manejar formularios (cumple requisito: useForm)
export function useForm<T>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    setValues({
      ...values,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const reset = () => setValues(initialValues);

  return { values, handleChange, reset, setValues };
}
