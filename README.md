# Plan Carro Juanjo

Simulador para decidir la compra del primer carro de Juan José (Sayreville, NJ): costo mensual real (crédito, seguro, gasolina, mantenimiento), inicial ideal, cuándo comprar y comparación de carros de la zona.

**Página:** https://hgomezgonzalez.github.io/juanjo-plan-carro/

- `data/cars.json`: carros revisados a mano (datos al 18 de octubre de 2026).
- `data/models.json`: datos por modelo para el análisis automático (MPG, reparación, depreciación, seguro, confiabilidad).
- En la página, **“Añadir un carro por link”** acepta links de Carfax, Cars.com o CarGurus. Con el VIN, el año, la marca y el modelo salen de la API pública de NHTSA. Los carros añadidos se guardan en el dispositivo y se pasan a otro con **“Compartir mi lista”**.

Son estimaciones con datos públicos. Antes de firmar hay que confirmar el precio con el concesionario y el seguro con una cotización real.

## Ver las líneas base desde cualquier aparato (hoja de Google)

La página puede guardar las líneas base, los carros añadidos y lo que cada uno está probando en una hoja de Google Sheets. Así se ven desde cualquier celular al recargar.

**Activarlo (una sola vez, ~5 minutos):**

1. En Google Drive crea una hoja de cálculo nueva, por ejemplo "Plan Carro Juanjo".
2. Menú **Extensiones → Apps Script**. Borra lo que aparece y pega el contenido de [`google-apps-script/Codigo.gs`](google-apps-script/Codigo.gs).
3. En la línea `const CODIGO = "cambia-este-codigo";` pon un código familiar (por ejemplo una palabra y un número). Guarda con el ícono del disquete.
4. **Implementar → Nueva implementación**. En el engranaje elige **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
5. Toca **Implementar**. Google pide permiso para que el script use tu hoja: **Autorizar acceso**. Puede salir "Google no ha verificado esta app": toca **Configuración avanzada → Ir a … (no seguro)**. Es tu propio script.
6. Copia la **URL de la aplicación web** (termina en `/exec`) y ponla en [`data/sync.json`](data/sync.json):
   ```json
   { "url": "https://script.google.com/macros/s/…/exec" }
   ```
7. En la página, sección **Tus líneas base**, cada persona escribe su nombre y el código familiar y toca **Conectar**.

El código familiar no está en este repositorio: solo lo saben ustedes. Sin él, la hoja no deja leer ni escribir. Si cambias el código en el script, toca **Implementar → Gestionar implementaciones → Editar → Nueva versión** para que se aplique.
