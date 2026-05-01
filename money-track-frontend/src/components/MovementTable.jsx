// Tabla que muestra ingresos y egresos
function MovementTable({ data }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th>Folio</th>
          <th>Tipo</th>
          <th>Fecha</th>
          <th>Nombre</th>
          <th>Monto</th>
        </tr>
      </thead>

      <tbody>
        {data.map((item) => (
          <tr key={item.id}>
            <td>{item.folio}</td>
            <td>{item.type}</td>
            <td>{item.date}</td>
            <td>{item.name}</td>
            <td>
              {/* Mostrar dinero con formato */}${item.amount.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default MovementTable;
