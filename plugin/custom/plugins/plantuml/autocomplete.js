// plugin/custom/plugins/plantuml/autocomplete.js
// PlantUML 围栏补全控制器 - UMD 模块

(function(root) {
    'use strict';

    var NamespaceManager = root.NamespaceManager;

    if (!NamespaceManager) {
        console.error('[PlantUML Autocomplete] Missing dependency: NamespaceManager');
        return;
    }

    function PlantUMLAutocomplete(config) {
        this.config = config || {};
        this.ns = NamespaceManager;
        this.popup = null;
        this.currentContext = null;
        this.inputHandler = null;
        this.keydownHandler = null;
        this.selectionHandler = null;
        this.clickHandler = null;
        this.repositionHandler = null;
    }

    PlantUMLAutocomplete.prototype.start = function() {
        if (this.config.enableFenceAutocomplete === false) {
            console.log('[PlantUML Autocomplete] Disabled by config');
            return;
        }

        if (this.inputHandler) {
            return;
        }

        this._ensurePopup();

        var self = this;
        this.inputHandler = function() {
            self.refresh();
        };
        this.keydownHandler = function(e) {
            self._handleKeydown(e);
        };
        this.selectionHandler = function() {
            self.refresh();
        };
        this.clickHandler = function(e) {
            self._handleClick(e);
        };
        this.repositionHandler = function() {
            self._repositionPopup();
        };

        document.addEventListener('input', this.inputHandler, true);
        document.addEventListener('keydown', this.keydownHandler, true);
        document.addEventListener('selectionchange', this.selectionHandler, true);
        document.addEventListener('mousedown', this.clickHandler, true);
        window.addEventListener('resize', this.repositionHandler);
        document.addEventListener('scroll', this.repositionHandler, true);

        console.log('[PlantUML Autocomplete] Started');
    };

    PlantUMLAutocomplete.prototype.stop = function() {
        if (!this.inputHandler) {
            return;
        }

        document.removeEventListener('input', this.inputHandler, true);
        document.removeEventListener('keydown', this.keydownHandler, true);
        document.removeEventListener('selectionchange', this.selectionHandler, true);
        document.removeEventListener('mousedown', this.clickHandler, true);
        window.removeEventListener('resize', this.repositionHandler);
        document.removeEventListener('scroll', this.repositionHandler, true);

        this.inputHandler = null;
        this.keydownHandler = null;
        this.selectionHandler = null;
        this.clickHandler = null;
        this.repositionHandler = null;
        this.currentContext = null;

        this.hide();
    };

    PlantUMLAutocomplete.prototype.refresh = function() {
        var context = this._getFenceContext();
        if (!context) {
            this.hide();
            return;
        }

        this.currentContext = context;
        this._renderPopup(context);
        this._repositionPopup();
    };

    PlantUMLAutocomplete.prototype.hide = function() {
        this.currentContext = null;
        if (this.popup) {
            this.popup.style.display = 'none';
        }
    };

    PlantUMLAutocomplete.prototype._handleKeydown = function(e) {
        if (!this.currentContext) {
            return;
        }

        if (e.key === 'Escape') {
            this.hide();
            return;
        }

        if (e.key === 'Tab') {
            if (this._acceptSuggestion()) {
                e.preventDefault();
            }
            return;
        }

        if (e.key === 'Enter') {
            if (this._acceptSuggestion()) {
                this.hide();
            }
        }
    };

    PlantUMLAutocomplete.prototype._handleClick = function(e) {
        if (!this.popup || this.popup.style.display === 'none') {
            return;
        }

        if (this.popup.contains(e.target)) {
            e.preventDefault();
            this._acceptSuggestion();
            this.hide();
            return;
        }

        var write = document.querySelector('#write');
        if (!write || !write.contains(e.target)) {
            this.hide();
            return;
        }

        var self = this;
        setTimeout(function() {
            self.refresh();
        }, 0);
    };

    PlantUMLAutocomplete.prototype._acceptSuggestion = function() {
        var context = this.currentContext;
        if (!context || !context.lineElement) {
            return false;
        }

        context.lineElement.textContent = context.replacement;
        this._placeCaretAtEnd(context.lineElement);
        this._dispatchInput(context.lineElement);

        console.log('[PlantUML Autocomplete] Accepted suggestion:', context.replacement);
        return true;
    };

    PlantUMLAutocomplete.prototype._dispatchInput = function(element) {
        var event;
        if (typeof InputEvent === 'function') {
            event = new InputEvent('input', {
                bubbles: true,
                cancelable: false,
                inputType: 'insertText',
                data: null
            });
        } else {
            event = document.createEvent('Event');
            event.initEvent('input', true, false);
        }
        element.dispatchEvent(event);
    };

    PlantUMLAutocomplete.prototype._placeCaretAtEnd = function(element) {
        var selection = window.getSelection();
        if (!selection) {
            return;
        }

        var range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    };

    PlantUMLAutocomplete.prototype._getFenceContext = function() {
        var selection = window.getSelection();
        if (!selection || !selection.rangeCount || !selection.isCollapsed) {
            return null;
        }

        var range = selection.getRangeAt(0);
        var lineElement = this._getCurrentLineElement(range.endContainer);
        if (!lineElement || lineElement.matches('pre.md-fences')) {
            return null;
        }

        if (!this._isCaretAtLineEnd(lineElement, range)) {
            return null;
        }

        var lineText = this._normalizeText(lineElement.textContent || '');
        var match = this._matchFenceLine(lineText);
        if (!match) {
            return null;
        }

        return {
            lineElement: lineElement,
            typed: match.typed,
            suggestion: match.suggestion,
            replacement: match.replacement
        };
    };

    PlantUMLAutocomplete.prototype._getCurrentLineElement = function(node) {
        var write = document.querySelector('#write');
        if (!write) {
            return null;
        }

        var element = node && node.nodeType === 1 ? node : (node ? node.parentElement : null);
        while (element && element !== write && element !== document.body) {
            if (element.parentElement === write) {
                return element;
            }
            element = element.parentElement;
        }

        return null;
    };

    PlantUMLAutocomplete.prototype._isCaretAtLineEnd = function(lineElement, range) {
        try {
            var beforeRange = range.cloneRange();
            beforeRange.selectNodeContents(lineElement);
            beforeRange.setEnd(range.endContainer, range.endOffset);

            var beforeText = this._normalizeText(beforeRange.toString());
            var lineText = this._normalizeText(lineElement.textContent || '');

            return beforeText.length === lineText.length;
        } catch (error) {
            console.warn('[PlantUML Autocomplete] Failed to inspect caret position:', error);
            return false;
        }
    };

    PlantUMLAutocomplete.prototype._matchFenceLine = function(lineText) {
        var match = /^(\s*)```([A-Za-z0-9_-]*)$/.exec(lineText);
        if (!match) {
            return null;
        }

        var typed = (match[2] || '').toLowerCase();
        var suggestion = 'plantuml';
        var minChars = this._getMinChars();

        if (typed === suggestion) {
            return null;
        }
        if (typed.length < minChars) {
            return null;
        }
        if (typed && suggestion.indexOf(typed) !== 0) {
            return null;
        }

        return {
            typed: typed,
            suggestion: suggestion,
            replacement: match[1] + '```' + suggestion
        };
    };

    PlantUMLAutocomplete.prototype._getMinChars = function() {
        var value = Number(this.config.fenceAutocompleteMinChars);
        if (!isFinite(value)) {
            return 3;
        }
        return Math.max(1, Math.floor(value));
    };

    PlantUMLAutocomplete.prototype._normalizeText = function(text) {
        return String(text || '')
            .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
            .replace(/\r\n?/g, '\n');
    };

    PlantUMLAutocomplete.prototype._ensurePopup = function() {
        if (this.popup) {
            return;
        }

        var popup = document.createElement('div');
        popup.className = this.ns.cls('autocomplete-popup');
        popup.style.display = 'none';
        popup.innerHTML =
            '<button type="button" class="' + this.ns.cls('autocomplete-item') + '">' +
            '  <span class="' + this.ns.cls('autocomplete-text') + '"></span>' +
            '  <span class="' + this.ns.cls('autocomplete-hint') + '">Tab</span>' +
            '</button>';

        document.body.appendChild(popup);
        this.popup = popup;
    };

    PlantUMLAutocomplete.prototype._renderPopup = function(context) {
        if (!this.popup) {
            return;
        }

        var text = this.popup.querySelector('.' + this.ns.cls('autocomplete-text'));
        if (text) {
            text.textContent = context.suggestion;
        }

        this.popup.style.display = 'block';
    };

    PlantUMLAutocomplete.prototype._repositionPopup = function() {
        if (!this.popup || !this.currentContext || this.popup.style.display === 'none') {
            return;
        }

        var rect = this.currentContext.lineElement.getBoundingClientRect();
        this.popup.style.top = (rect.bottom + window.scrollY + 6) + 'px';
        this.popup.style.left = (rect.left + window.scrollX) + 'px';
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PlantUMLAutocomplete;
    } else if (typeof define === 'function' && define.amd) {
        define(function() { return PlantUMLAutocomplete; });
    } else {
        root.PlantUMLAutocomplete = PlantUMLAutocomplete;
    }

})(typeof global !== 'undefined' ? global : window);
