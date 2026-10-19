# Plan Carro Juanjo

Simulador para decidir la compra del primer carro de Juan José (Sayreville, NJ): costo mensual real (crédito, seguro, gasolina, mantenimiento), inicial ideal, cuándo comprar y comparación de carros de la zona.

**Página:** https://hgomezgonzalez.github.io/juanjo-plan-carro/

- `data/cars.json`: carros revisados a mano (datos al 18 de octubre de 2026).
- `data/models.json`: datos por modelo para el análisis automático (MPG, reparación, depreciación, seguro, confiabilidad).
- En la página, **“Añadir un carro por link”** acepta links de Carfax, Cars.com o CarGurus. Con el VIN, el año, la marca y el modelo salen de la API pública de NHTSA. Los carros añadidos se guardan en el dispositivo y se pasan a otro con **“Compartir mi lista”**.

Son estimaciones con datos públicos. Antes de firmar hay que confirmar el precio con el concesionario y el seguro con una cotización real.
