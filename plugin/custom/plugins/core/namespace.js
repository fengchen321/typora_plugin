// plugin/custom/plugins/core/namespace.js

const PREFIX = "tp_";

const NamespaceManager = {
    cls: (name) => `${PREFIX}${name}`,
    dataAttr: (name) => `data-${PREFIX}${name}`,
    event: (name) => `${PREFIX}:${name}`,
    selector: (name) => `.${PREFIX}${name}`,
};

module.exports = NamespaceManager;