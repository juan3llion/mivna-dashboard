# MIVNA TEST: E-commerce Architecture
class InventorySystem:
    def check_stock(self, product_id):
        print(f"📦 Checking stock for {product_id}...")
        return True

class PaymentProcessor:
    def charge_card(self, user_id, amount):
        print(f"💳 Charging ${amount} to user {user_id}...")
        return "Transaction_SUCCESS"

class ShoppingCart:
    def __init__(self):
        self.items = []
    
    def add_item(self, product):
        self.items.append(product)

class OrderManager:
    """Clase principal que coordina la compra"""
    def __init__(self):
        self.inventory = InventorySystem()
        self.payment = PaymentProcessor()
        self.cart = ShoppingCart()

    def checkout(self, user_id):
        # 1. Verificar inventario de todo
        for item in self.cart.items:
            if not self.inventory.check_stock(item):
                raise Exception("Out of stock!")
        
        # 2. Cobrar
        status = self.payment.charge_card(user_id, 100)
        
        if status == "Transaction_SUCCESS":
            print("✅ Order placed successfully!")
            return True
        return False
