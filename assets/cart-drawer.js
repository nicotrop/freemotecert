class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink)
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  isUpsellInCart() {
    const upsoldVariantID = document.querySelector('product-form#upselling-form form').querySelector('[name=id]').value;
    const allItems = document.querySelectorAll('cart-remove-button button')
    let idsArr=[];
    allItems.forEach(item => {
      let id = (item.getAttribute('data-currid'));
      idsArr = [...idsArr, id];
    });
    const isInCart = idsArr?.includes(upsoldVariantID)??false;
    return isInCart;
  }

  upsellDisplayLogic(isInCart) {
    if (isInCart) {
      document.querySelector('.custom-upsell-wrapper').classList.add('hidden');
    } else {
      document.querySelector('.custom-upsell-wrapper').classList.remove('hidden');
    }
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);

    //Run logic to display upsell or not on cart drawer open
    const isInCart = this.isUpsellInCart();
    this.upsellDisplayLogic(isInCart);

    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {this.classList.add('animate', 'active')});

    this.addEventListener('transitionend', () => {
      const containerToTrapFocusOn = this.classList.contains('is-empty') ? this.querySelector('.drawer__inner-empty') : document.getElementById('CartDrawer');
      const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
      trapFocus(containerToTrapFocusOn, focusElement);
    }, { once: true });

    document.body.classList.add('overflow-hidden');
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if(cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    this.querySelector('.drawer__inner').classList.contains('is-empty') && this.querySelector('.drawer__inner').classList.remove('is-empty');
    this.productId = parsedState.id;

    //Check if the upsold variant id is in the cart
    const isInCart = this.isUpsellInCart();
    console.log("cart-drawer renderContents isInCart: ", isInCart)

    this.getSectionsToRender().forEach((section => {
      const sectionElement = section.selector ? document.querySelector(section.selector) : document.getElementById(section.id);

      if (this.productId === upsoldVariantID || isInCart) {
        sectionElement.innerHTML = this.getSectionInnerHTMLModified(parsedState.sections[section.id], section.selector);
      } else {
        sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
      }
      sectionElement.innerHTML =
          this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
    }));

    setTimeout(() => {
      this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
      this.open();
    });
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  // Modified to exclude the custom upsell section upon reloading the cart
  getSectionInnerHTMLModified(html, selector = '.shopify-section') {
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

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer'
      },
      {
        id: 'cart-icon-bubble',
      }
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner'
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section'
      }
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
