# MIVNA FINAL TEST: Sistema Bancario
class BaseDatos:
    def conectar(self):
        print("Conectando a PostgreSQL...")
        return True

class NotificadorEmail:
    def enviar(self, mensaje):
        print(f"ENVIANDO EMAIL: {mensaje}")

class CuentaBancaria:
    def __init__(self, usuario, saldo_inicial):
        self.usuario = usuario
        self.saldo = saldo_inicial
        self.db = BaseDatos()
        self.email = NotificadorEmail()

    def transferir(self, destino, monto):
        if self.db.conectar():
            if self.saldo >= monto:
                self.saldo -= monto
                destino.saldo += monto
                self.email.enviar(f"Transferencia de ${monto} exitosa")
                return True
        return False
