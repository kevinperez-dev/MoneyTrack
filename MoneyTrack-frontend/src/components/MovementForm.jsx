import { useState } from 'react';

// Formulario para agregar ingresos o egresos
function MovementForm({ onAdd }) {
  const [form, setForm] = useState({
    type: 'ingreso',
    name: '',
    amount: '',
  });

  // Maneja cambios en inputs
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // Envía nuevo movimiento
  const handleSubmit = (e) => {
    e.preventDefault();

    // Crear objeto nuevo
    const newMovement = {
      id: Date.now(),
      folio: `${form.type === 'ingreso' ? 'ING' : 'EGR'}-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      ...form,
      amount: Number(form.amount),
    };

    onAdd(newMovement);

    // Reset
    setForm({
      type: 'ingreso',
      name: '',
      amount: '',
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
      <select name="type" value={form.type} onChange={handleChange}>
        <option value="ingreso">Ingreso</option>
        <option value="egreso">Egreso</option>
      </select>

      <input
        type="text"
        name="name"
        placeholder="Nombre"
        value={form.name}
        onChange={handleChange}
      />

      <input
        type="number"
        name="amount"
        placeholder="Monto"
        value={form.amount}
        onChange={handleChange}
      />

      <button type="submit">Agregar</button>
    </form>
  );
}

export default MovementForm;
