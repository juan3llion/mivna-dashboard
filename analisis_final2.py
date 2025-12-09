# MIVNA FINAL TEST: Sistema de Inventario
class Producto:
    def __init__(self, id, nombre, precio):
        self.id = id
        self.nombre = nombre
        self.precio = precio

class BaseDeDatos:
    def guardar(self, producto):
        print(f"Guardando {producto.nombre} en SQL...")

class Inventario:
    def __init__(self, db: BaseDeDatos):
        self.db = db
        self.productos = []

    def agregar_producto(self, producto):
        self.productos.append(producto)
        self.db.guardar(producto)
        return True
