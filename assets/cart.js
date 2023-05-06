//Get the variant id of the upsold variant
const upsoldVariantID = document?.querySelector('product-form#upselling-form form')?.querySelector('[name=id]')?.value;

function isUpsellInCart() {
  const allItems = document.querySelectorAll('cart-remove-button button')
  let idsArr=[];
  allItems.forEach(item => {
    let id = (item.getAttribute('data-currid'));
    idsArr = [...idsArr, id];
  });
  const isInCart = idsArr?.includes(upsoldVariantID)??false;
  return {
    isInCart,
    allItems
  };
}

class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      //Prevent the default behaviour of the button
      event.preventDefault();
      //Select the cart-items or cart-drawer-items component depending on where the button is
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');

      //If there is an upsold variant
      if(upsoldVariantID){
      //Select the current button based on the event's closest element
      const buttonElement = event.target.closest('cart-remove-button').querySelector('button');
      //Extract id of the variant being removed
      const curridValue = buttonElement.getAttribute('data-currid');
      // //Check if the upsold variant is in the cart
      const { isInCart, allItems } = isUpsellInCart();
      console.log("Remove button component", isInCart);


        //And if the variant being removed is the upsold variant or if there is only one item remaining in the cart
        if (curridValue === upsoldVariantID || allItems.length === 1 || !isInCart) {
          //Re-render to show the upsell
          cartItems.updateQuantity(this.dataset.index, 0, name, "keep");
          //Otherwise, if the variant being removed is not the upsold variant AND ID NOT PRESENT IN THE CART
        } else {
          //Don't re-render to keep the upsell
          cartItems.updateQuantity(this.dataset.index, 0, name, "exclude");
        }

      //If there is no upsold variant at all
      } else {
        //Default behaviour
        cartItems.updateQuantity(this.dataset.index, 0);
      }
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement = document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    // Subscribe to cart updates so we know when to re-render
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      // If the event was triggered by this component, don't re-render
      if (event.source === 'cart-items') {
        return;
      }

      this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  onChange(event) {
    
    if(upsoldVariantID){

      // //Check if the upsold variant is in the cart
      const { isInCart } = isUpsellInCart();
      console.log("Cart component onChange function", isInCart);

      //If the upsold variant is in the cart
      if (isInCart) {
        //Skip re-rendering of the upsell component
        this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'), "exclude");
      } else {
        //Otherwise, re-render the upsell component
        this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'), "keep");
      }
    //If there is no upsold variant, execute default function
    } else {
      this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'));
    }

  }

  onCartUpdate() {
    fetch('/cart?section_id=main-cart-items')
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        const sourceQty = html.querySelector('cart-items');
        this.innerHTML = sourceQty.innerHTML;
      })
      .catch(e => {
        console.error(e);
      });
  }
  

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents'
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section'
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section'
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents'
      }
    ];
  }

  updateQuantity(line, quantity, name, action) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        const quantityElement = document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll('.cart-item');

        if (parsedState.errors) {
          quantityElement.value = quantityElement.getAttribute('value');
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');

        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);


        this.getSectionsToRender().forEach((section => {
          const elementToReplace = 
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
          
            //If upsold variant exists and the value for action is either reload or skip
           if (upsoldVariantID && (action === "keep" || action === "exclude") ){
              //If action is reload, re-render the entire section
             if(action === "keep") {
               console.log("keep");
               elementToReplace.innerHTML = 
               this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);
             } else {
              //Otherwise, re-render the section excluding the upsell component
               console.log("exclude");
               elementToReplace.innerHTML =
               this.getSectionInnerHTMLModified(parsedState.sections[section.section], section.selector);
             }
           } else {
            //Otherwise, follow default behavior
              console.log("default");
              elementToReplace.innerHTML = 
              this.getSectionInnerHTML(parsedState.sections[section.section], section.selector);
           }

        }));
        const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
        let message = '';
        if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
          if (typeof updatedValue === 'undefined') {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
          }
        }

        this.updateLiveRegions(line, message);

        const lineItem = document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`)) : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'))
        } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'))
        }
        publish(PUB_SUB_EVENTS.cartUpdate, {source: 'cart-items'});
      }).catch(() => {
        this.querySelectorAll('.loading-overlay').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError = document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').innerHTML = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus = document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    console.log("cart getInner" ,selector)
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  // Modified to exclude the custom upsell section upon reloading the cart
  getSectionInnerHTMLModified(html, selector = '.shopify-section') {
    console.log("cart getInnerModified" ,selector)
    const dom = new DOMParser().parseFromString(html, 'text/html');
    // Find the section element
    const sectionEl = dom.querySelector(selector);
    // Exclude the custom upsell section
    const elementToExclude = sectionEl.querySelector('.custom-upsell-wrapper');
  
    //If the section to exclude is truthy, then remove it from the section element
    if (elementToExclude) {
      const contents = sectionEl.innerHTML.replace(elementToExclude.outerHTML, '');
      return contents;
    } else {
      // Element to exclude does not exist, so render the entire section
      return sectionEl.innerHTML;
    }
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading-overlay`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading-overlay`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading-overlay`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading-overlay`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define('cart-note', class CartNote extends HTMLElement {
      constructor() {
        super();

      this.addEventListener('change', debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
      }, ON_CHANGE_DEBOUNCE_TIMER))
      }
  });
};
