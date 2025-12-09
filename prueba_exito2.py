# MIVNA SUCCESS TEST
class Usuario:
    def __init__(self, nombre):
        self.nombre = nombre

class Autenticacion:
    def login(self, usuario):
        print(f"Logueando a {usuario.nombre}...")
        return True

class App:
    def iniciar(self):
        user = Usuario("Juan")
        auth = Autenticacion()
        auth.login(user)
