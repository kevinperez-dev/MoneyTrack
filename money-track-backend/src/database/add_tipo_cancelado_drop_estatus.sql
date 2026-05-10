-- Archivo: add_tipo_cancelado_drop_estatus.sql
-- Propósito:
-- 1. Usar la columna tipo para ingreso, egreso y cancelado.
-- 2. Migrar registros con estatus = cancelado hacia tipo = cancelado.
-- 3. Eliminar la columna estatus si existe.
-- 4. Permitir Pesos, Dolares y Dólares en moneda.

-- Propósito: cerrar una transacción fallida en pgAdmin si quedó bloqueada.
ROLLBACK;

-- Propósito: eliminar restricciones viejas relacionadas con tipo antes de cambiar valores.
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.movements'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%tipo%'
    LOOP
        EXECUTE format('ALTER TABLE public.movements DROP CONSTRAINT %I', constraint_record.conname);
    END LOOP;
END $$;

-- Propósito: si existe estatus, pasar sus cancelados a la columna tipo.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'movements'
          AND column_name = 'estatus'
    ) THEN
        UPDATE public.movements
        SET tipo = 'cancelado'
        WHERE LOWER(TRIM(estatus)) IN ('cancelado', 'cancelada', 'cancelled', 'canceled');
    END IF;
END $$;

-- Propósito: normalizar valores actuales en tipo.
UPDATE public.movements
SET tipo = LOWER(TRIM(tipo));

UPDATE public.movements
SET tipo = 'ingreso'
WHERE tipo IN ('ingresos', 'income');

UPDATE public.movements
SET tipo = 'egreso'
WHERE tipo IN ('egresos', 'expense', 'expenses', 'gasto', 'gastos');

UPDATE public.movements
SET tipo = 'cancelado'
WHERE tipo IN ('cancelada', 'cancelled', 'canceled');

-- Propósito: si quedó algún tipo inválido, detener antes de crear la restricción.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.movements
        WHERE tipo NOT IN ('ingreso', 'egreso', 'cancelado')
    ) THEN
        RAISE EXCEPTION 'Existen valores inválidos en movements.tipo. Revisa con: SELECT DISTINCT tipo FROM public.movements;';
    END IF;
END $$;

-- Propósito: crear la nueva regla para tipo.
ALTER TABLE public.movements
ADD CONSTRAINT movements_tipo_check
CHECK (tipo IN ('ingreso', 'egreso', 'cancelado'));

-- Propósito: eliminar restricciones viejas relacionadas con moneda.
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.movements'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%moneda%'
    LOOP
        EXECUTE format('ALTER TABLE public.movements DROP CONSTRAINT %I', constraint_record.conname);
    END LOOP;
END $$;

-- Propósito: normalizar variantes comunes de moneda.
UPDATE public.movements
SET moneda = 'Pesos'
WHERE moneda IN ('pesos', 'PESOS', 'MXN', 'mxn');

UPDATE public.movements
SET moneda = 'Dolares'
WHERE moneda IN ('dolares', 'DOLARES', 'USD', 'usd');

UPDATE public.movements
SET moneda = 'Dólares'
WHERE moneda IN ('dólares', 'DÓLARES');

-- Propósito: aceptar dólares con o sin acento para evitar errores de captura.
ALTER TABLE public.movements
ADD CONSTRAINT movements_moneda_check
CHECK (moneda IN ('Pesos', 'Dolares', 'Dólares'));

-- Propósito: eliminar columna estatus porque cancelado ahora vive en tipo.
ALTER TABLE public.movements
DROP COLUMN IF EXISTS estatus;

-- Propósito: asegurar índices usados por filtros.
CREATE INDEX IF NOT EXISTS idx_movements_tipo ON public.movements(tipo);
CREATE INDEX IF NOT EXISTS idx_movements_fecha ON public.movements(fecha);
CREATE INDEX IF NOT EXISTS idx_movements_folio ON public.movements(folio);

-- Propósito: verificar resultado final.
SELECT tipo, COUNT(*) AS total
FROM public.movements
GROUP BY tipo
ORDER BY tipo;

SELECT moneda, COUNT(*) AS total
FROM public.movements
GROUP BY moneda
ORDER BY moneda;

SELECT
    conname AS nombre_restriccion,
    pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.movements'::regclass
  AND contype = 'c'
ORDER BY conname;
