const CART_KEY = 'kabarakSokoCart';

let cart = [];

function loadCart() {
    try {
        const savedCart = localStorage.getItem(CART_KEY);

        if (!savedCart) {
            cart = [];
            return;
        }

        const parsedCart = JSON.parse(savedCart);

        if (!Array.isArray(parsedCart)) {
            cart = [];
            return;
        }

        cart = parsedCart;
    } catch (error) {
        console.error('Failed to load cart:', error);
        cart = [];
    }
}

function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (error) {
        console.error('Failed to save cart:', error);
        showNotification('Unable to save your cart.');
    }
}

function getCartCount() {
    return cart.reduce((total, item) => {
        return total + Number(item.quantity || 0);
    }, 0);
}

function getCartTotal() {
    return cart.reduce((total, item) => {
        const price = Number(item.price || 0);
        const quantity = Number(item.quantity || 0);

        return total + price * quantity;
    }, 0);
}

function formatPrice(value) {
    return `KSh ${Number(value || 0).toLocaleString('en-KE')}`;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getProductImage(item) {
    if (
        Array.isArray(item.images) &&
        item.images.length > 0 &&
        item.images[0]
    ) {
        return item.images[0];
    }

    return 'https://via.placeholder.com/300x300?text=Kabarak+Soko';
}

function updateCartCount() {
    const cartCount = document.getElementById('cartCount');

    if (cartCount) {
        cartCount.textContent = getCartCount();
    }
}

function showNotification(message) {
    const notification = document.getElementById('notification');

    if (!notification) {
        return;
    }

    notification.textContent = message;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 2500);
}

function increaseQuantity(productId) {
    const item = cart.find((product) => {
        return String(product.id || product._id) === String(productId);
    });

    if (!item) {
        return;
    }

    const stock = Number(item.stock);

    if (Number.isFinite(stock) && stock > 0) {
        if (item.quantity >= stock) {
            showNotification('You have reached the available stock.');
            return;
        }
    }

    item.quantity += 1;

    saveCart();
    renderCart();
}

function decreaseQuantity(productId) {
    const item = cart.find((product) => {
        return String(product.id || product._id) === String(productId);
    });

    if (!item) {
        return;
    }

    if (item.quantity <= 1) {
        removeFromCart(productId);
        return;
    }

    item.quantity -= 1;

    saveCart();
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter((item) => {
        return String(item.id || item._id) !== String(productId);
    });

    saveCart();
    renderCart();

    showNotification('Product removed from cart.');
}

function clearCart() {
    if (cart.length === 0) {
        return;
    }

    const confirmed = window.confirm(
        'Are you sure you want to remove all products from your cart?'
    );

    if (!confirmed) {
        return;
    }

    cart = [];

    saveCart();
    renderCart();

    showNotification('Cart cleared.');
}

function checkout() {
    if (cart.length === 0) {
        showNotification('Your cart is empty.');
        return;
    }

    showNotification(
        'Checkout will be enabled in Step 8.'
    );
}

function renderEmptyCart() {
    const cartContainer = document.getElementById('cartContainer');

    cartContainer.innerHTML = `
        <section class="empty-cart">
            <div class="empty-cart-icon">🛒</div>
            <h2>Your cart is empty</h2>
            <p>Add products to your cart and they will appear here.</p>
            <a href="/" class="shop-button">Continue Shopping</a>
        </section>
    `;
}

function renderCart() {
    const cartContainer = document.getElementById('cartContainer');
    const cartDescription = document.getElementById('cartDescription');

    updateCartCount();

    if (cart.length === 0) {
        if (cartDescription) {
            cartDescription.textContent = 'Your cart is currently empty.';
        }

        renderEmptyCart();
        return;
    }

    if (cartDescription) {
        cartDescription.textContent =
            `${getCartCount()} item${getCartCount() === 1 ? '' : 's'} in your cart`;
    }

    let itemsHtml = '';

    cart.forEach((item) => {
        const productId = item.id || item._id;
        const quantity = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        const total = price * quantity;

        itemsHtml += `
            <article class="cart-item">
                <img
                    class="product-image"
                    src="${escapeHtml(getProductImage(item))}"
                    alt="${escapeHtml(item.name)}"
                    onerror="this.src='https://via.placeholder.com/300x300?text=Kabarak+Soko'"
                >

                <div>
                    <div class="product-name">
                        ${escapeHtml(item.name)}
                    </div>

                    <div class="product-category">
                        ${escapeHtml(item.category || 'Product')}
                    </div>

                    <div class="product-price">
                        ${formatPrice(price)}
                    </div>

                    <div class="stock-text">
                        ${
                            Number(item.stock) > 0
                                ? `${Number(item.stock)} available`
                                : 'Stock information unavailable'
                        }
                    </div>

                    <div class="quantity-area">
                        <button
                            type="button"
                            class="quantity-button"
                            onclick="decreaseQuantity('${escapeHtml(productId)}')"
                        >
                            −
                        </button>

                        <span class="quantity">
                            ${quantity}
                        </span>

                        <button
                            type="button"
                            class="quantity-button"
                            onclick="increaseQuantity('${escapeHtml(productId)}')"
                        >
                            +
                        </button>
                    </div>

                    <button
                        type="button"
                        class="remove-button"
                        onclick="removeFromCart('${escapeHtml(productId)}')"
                    >
                        Remove
                    </button>
                </div>

                <div class="item-total">
                    ${formatPrice(total)}
                </div>
            </article>
        `;
    });

    const subtotal = getCartTotal();

    cartContainer.innerHTML = `
        <div class="cart-layout">

            <section class="cart-items">
                ${itemsHtml}

                <div style="padding: 18px; border-top: 1px solid #eee;">
                    <button
                        type="button"
                        class="remove-button"
                        onclick="clearCart()"
                    >
                        Clear entire cart
                    </button>
                </div>
            </section>

            <aside class="summary">
                <h2>Order Summary</h2>

                <div class="summary-row">
                    <span>Items</span>
                    <span>${getCartCount()}</span>
                </div>

                <div class="summary-row">
                    <span>Subtotal</span>
                    <span>${formatPrice(subtotal)}</span>
                </div>

                <div class="summary-row">
                    <span>Delivery</span>
                    <span>Calculated at checkout</span>
                </div>

                <div class="summary-total">
                    <span>Total</span>
                    <span>${formatPrice(subtotal)}</span>
                </div>

                <button
                    type="button"
                    class="checkout-button"
                    onclick="checkout()"
                >
                    Proceed to Checkout
                </button>

                <a href="/" class="continue-button">
                    Continue Shopping
                </a>
            </aside>

        </div>
    `;
}

function searchProducts() {
    const searchInput = document.getElementById('searchInput');

    if (!searchInput) {
        return;
    }

    const searchTerm = searchInput.value.trim();

    if (!searchTerm) {
        window.location.href = '/';
        return;
    }

    window.location.href =
        `/?search=${encodeURIComponent(searchTerm)}`;
}

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    renderCart();

    const searchButton = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');

    if (searchButton) {
        searchButton.addEventListener('click', searchProducts);
    }

    if (searchInput) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                searchProducts();
            }
        });
    }
});