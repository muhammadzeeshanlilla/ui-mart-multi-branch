import { api, sessionId } from './api.js';
import { config } from './config.js';
(function () {
    'use strict';

    const GENERIC_ERROR_MESSAGE = "Sorry, I couldn't connect to the assistant right now. Please try again.";

    const launcher = document.getElementById('uiChatLauncher');
    const panel = document.getElementById('uiChatPanel');
    const closeButton = document.getElementById('uiChatClose');
    const messages = document.getElementById('uiChatMessages');
    const form = document.getElementById('uiChatForm');
    const input = document.getElementById('uiChatInput');
    const sendButton = document.getElementById('uiChatSend');

    if (!launcher || !panel || !closeButton || !messages || !form || !input || !sendButton) return;

    panel.inert = true;
    document.querySelectorAll('[data-open-chat]').forEach(button => button.addEventListener('click', () => setPanelOpen(true)));
    if (location.hash === '#assistant') setPanelOpen(true);
    let isSending = false;
    let quickActions = null;
    const conversationId = sessionId();
    let context = {};

    addAssistantMessage(
        (config.preview ? 'Preview assistant: sample data only.\n\n' : '') + 'Assalam-o-Alaikum! I can help with products, AED prices, stock, deals and all three branches. English or Roman Urdu is welcome. Chats are saved for the owner to review; please avoid sharing sensitive information.'
    );
    addQuickActions();
    updateSendButton();

    launcher.addEventListener('click', function () {
        setPanelOpen(!panel.classList.contains('is-open'));
    });

    closeButton.addEventListener('click', function () {
        setPanelOpen(false);
    });

    input.addEventListener('input', updateSendButton);

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        sendMessage(input.value);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && panel.classList.contains('is-open')) {
            setPanelOpen(false);
        }
    });

    function setPanelOpen(open) {
        panel.classList.toggle('is-open', open);
        panel.setAttribute('aria-hidden', String(!open));
        panel.inert = !open;
        launcher.setAttribute('aria-expanded', String(open));
        launcher.setAttribute('aria-label', open ? 'Close customer assistant' : 'Open customer assistant');

        if (open) {
            scrollToLatest();
            window.setTimeout(function () { input.focus(); }, 80);
        } else {
            launcher.focus();
        }
    }

    async function sendMessage(rawMessage) {
        const message = String(rawMessage || '').trim();
        if (!message || isSending) return;

        isSending = true;
        input.value = '';
        setLoadingState(true);
        removeQuickActions();
        addUserMessage(message);
        const typingMessage = addTypingIndicator();

        try {
            const response = await requestChatbot(message);
            typingMessage.remove();
            renderBackendResponse(response);
        } catch (error) {
            typingMessage.remove();
            addAssistantMessage(GENERIC_ERROR_MESSAGE, true);
            input.value = message;
        } finally {
            isSending = false;
            setLoadingState(false);
            scrollToLatest();
            if (panel.classList.contains('is-open')) input.focus();
        }
    }

    async function requestChatbot(message) {
        const response = await api('chat', { message, context, session_id: conversationId });
        context = response.context || {};
        return response;
    }

    function renderBackendResponse(response) {
        if (response.success !== true) {
            const backendMessage = typeof response.message === 'string' && response.message.trim()
                ? response.message.trim()
                : GENERIC_ERROR_MESSAGE;
            addAssistantMessage(backendMessage, true);
            return;
        }

        if (typeof response.reply !== 'string' || !response.reply.trim()) {
            addAssistantMessage(GENERIC_ERROR_MESSAGE, true);
            return;
        }

        const content = addAssistantMessage(response.reply);
        renderProducts(content, response.products);
        (response.deals || []).forEach(function(deal) {
            const card = createElement('div', 'ui-chat-product-card');
            card.textContent = deal.branch + ': ' + deal.title + ' — ' + deal.description;
            content.appendChild(card);
        });
        (response.contacts || []).forEach(function(contact) { renderContact(content, contact); });
        renderContact(content, response.contact);
        scrollToLatest();
    }

    function addUserMessage(text) {
        const row = createElement('div', 'ui-chat-message ui-chat-message--user');
        const content = createElement('div', 'ui-chat-message-content');
        const bubble = createElement('div', 'ui-chat-bubble');
        bubble.textContent = text;
        content.appendChild(bubble);
        row.appendChild(content);
        messages.appendChild(row);
        scrollToLatest();
    }

    function addAssistantMessage(text, isError) {
        const row = createElement('div', 'ui-chat-message ui-chat-message--assistant');
        const avatar = createElement('div', 'ui-chat-avatar');
        avatar.setAttribute('aria-hidden', 'true');
        const avatarIcon = createElement('i', 'fas fa-store-alt');
        avatarIcon.textContent = 'U&I';
        avatar.appendChild(avatarIcon);

        const content = createElement('div', 'ui-chat-message-content');
        const bubble = createElement('div', 'ui-chat-bubble' + (isError ? ' ui-chat-bubble--error' : ''));
        bubble.textContent = text;
        content.appendChild(bubble);
        row.appendChild(avatar);
        row.appendChild(content);
        messages.appendChild(row);
        scrollToLatest();
        return content;
    }

    function addTypingIndicator() {
        const row = createElement('div', 'ui-chat-message ui-chat-message--assistant');
        const avatar = createElement('div', 'ui-chat-avatar');
        avatar.setAttribute('aria-hidden', 'true');
        avatar.textContent = 'U&I';
        const content = createElement('div', 'ui-chat-message-content');
        const bubble = createElement('div', 'ui-chat-bubble ui-chat-typing');
        bubble.setAttribute('role', 'status');
        bubble.setAttribute('aria-label', 'Assistant is typing');
        for (let index = 0; index < 3; index += 1) bubble.appendChild(document.createElement('span'));
        content.appendChild(bubble);
        row.appendChild(avatar);
        row.appendChild(content);
        messages.appendChild(row);
        scrollToLatest();
        return row;
    }

    function addQuickActions() {
        quickActions = createElement('div', 'ui-chat-quick-actions');
        quickActions.setAttribute('aria-label', 'Suggested questions');
        const actions = [
            { label: 'Check Product Price', value: 'What is the price of ', mode: 'fill' },
            { label: 'Check Availability', value: 'Is ', mode: 'fill' },
            { label: 'Our branches', value: 'Where are your branches?', mode: 'send' },
            { label: 'Current deals', value: 'What deals are available?', mode: 'send' }
        ];

        actions.forEach(function (action) {
            const button = createElement('button', 'ui-chat-quick-action');
            button.type = 'button';
            button.textContent = action.label;
            button.addEventListener('click', function () {
                if (isSending) return;
                if (action.mode === 'send') {
                    sendMessage(action.value);
                } else {
                    input.value = action.value;
                    updateSendButton();
                    input.focus();
                    input.setSelectionRange(input.value.length, input.value.length);
                }
            });
            quickActions.appendChild(button);
        });
        messages.appendChild(quickActions);
    }

    function removeQuickActions() {
        if (quickActions && quickActions.isConnected) quickActions.remove();
        quickActions = null;
    }

    function renderProducts(container, products) {
        if (!Array.isArray(products) || !products.length) return;
        const list = createElement('div', 'ui-chat-products');

        products.forEach(function (product) {
            if (!product || typeof product !== 'object' || Array.isArray(product)) return;
            const hasName = typeof product.name === 'string' && product.name.trim();
            if (!hasName) return;

            const card = createElement('div', 'ui-chat-product-card');
            const name = createElement('div', 'ui-chat-product-name');
            name.textContent = product.name.trim();
            card.appendChild(name);

            if (typeof product.category === 'string' && product.category.trim()) {
                const category = createElement('div', 'ui-chat-product-category');
                category.textContent = product.category.trim() + ' · ' + product.branch;
                card.appendChild(category);
            }

            const details = createElement('div', 'ui-chat-product-details');
            let hasDetails = false;
            if (typeof product.price === 'number' && Number.isFinite(product.price)) {
                const price = createElement('div', 'ui-chat-product-price');
                price.textContent = new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(product.price);
                details.appendChild(price);
                hasDetails = true;
            }

            if (product.stock_status === 'in_stock' || product.stock_status === 'out_of_stock') {
                const stock = createElement(
                    'div',
                    'ui-chat-stock ' + (product.stock_status === 'in_stock' ? 'ui-chat-stock--in' : 'ui-chat-stock--out')
                );
                stock.textContent = product.stock_status === 'in_stock' ? 'In Stock' : 'Out of Stock';
                details.appendChild(stock);
                hasDetails = true;
            }
            if (hasDetails) card.appendChild(details);

            const metaValues = [];
            if (typeof product.quantity === 'number') metaValues.push('Quantity: ' + product.quantity);
            if (product.brand) metaValues.push(product.brand);
            if (typeof product.weight === 'string' && product.weight.trim()) metaValues.push(product.weight.trim());
            if (typeof product.unit === 'string' && product.unit.trim()) metaValues.push(product.unit.trim());
            if (metaValues.length) {
                const meta = createElement('div', 'ui-chat-product-meta');
                meta.textContent = metaValues.join(' \u2022 ');
                card.appendChild(meta);
            }
            list.appendChild(card);
        });

        if (list.childElementCount) container.appendChild(list);
    }

    function renderContact(container, contact) {
        if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return;
        const actions = createElement('div', 'ui-chat-contact');

        if (typeof contact.phone === 'string' && contact.phone.trim()) {
            const telephone = contact.phone.replace(/[^+\d]/g, '');
            if (telephone) actions.appendChild(createActionLink('Call', 'fas fa-phone-alt', 'tel:' + telephone, false));
        }

        const whatsappUrl = getSafeExternalUrl(contact.whatsapp);
        if (whatsappUrl) actions.appendChild(createActionLink('WhatsApp', 'fab fa-whatsapp', whatsappUrl, true));

        const mapsUrl = getSafeExternalUrl(contact.maps_url);
        if (mapsUrl) actions.appendChild(createActionLink('View Map', 'fas fa-map-marker-alt', mapsUrl, true));

        if (actions.childElementCount) container.appendChild(actions);
    }

    function createActionLink(label, iconClass, href, external) {
        const link = createElement('a', 'ui-chat-action');
        link.href = href;
        link.setAttribute('aria-label', label);
        if (external) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
        const icon = createElement('i', iconClass);
        icon.setAttribute('aria-hidden', 'true');
        const text = document.createElement('span');
        text.textContent = label;
        link.appendChild(icon);
        link.appendChild(text);
        return link;
    }

    function getSafeExternalUrl(value) {
        if (typeof value !== 'string' || !value.trim()) return '';
        try {
            const url = new URL(value.trim());
            return url.protocol === 'https:' ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function setLoadingState(loading) {
        input.disabled = loading;
        sendButton.classList.toggle('is-loading', loading);
        sendButton.setAttribute('aria-label', loading ? 'Sending message' : 'Send message');
        messages.setAttribute('aria-busy', String(loading));
        const icon = sendButton.querySelector('i');
        if (icon) icon.className = loading ? 'fas fa-spinner' : 'fas fa-paper-plane';
        updateSendButton();
    }

    function updateSendButton() {
        sendButton.disabled = isSending || !input.value.trim();
    }

    function scrollToLatest() {
        window.requestAnimationFrame(function () {
            messages.scrollTop = messages.scrollHeight;
        });
    }

    function createElement(tagName, className) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        return element;
    }
}());
