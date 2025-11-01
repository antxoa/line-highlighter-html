'use strict';

let subscriptions = [];
let decorations = new WeakMap();
let styleElement = null;
let isEnabled = false;

module.exports = {
  activate() {
    const commandSub = atom.commands.add('atom-workspace', {
      'line-highlighter-html:toggle': () => this.toggleHighlight()
    });
    subscriptions.push(commandSub);
  },

  deactivate() {
    subscriptions.forEach(sub => sub.dispose());
    subscriptions = [];

    if (styleElement) {
      styleElement.remove();
      styleElement = null;
    }

    this.limpiarTodo();
    isEnabled = false;
  },

  toggleHighlight() {
    isEnabled = !isEnabled;

    if (isEnabled) {
      this.iniciarResaltado();
      atom.notifications.addSuccess('Line Highlighter HTML: Activado');
    } else {
      this.limpiarTodo();
      atom.notifications.addInfo('Line Highlighter HTML: Desactivado');
    }
  },

  iniciarResaltado() {
    const configResaltar = atom.config.get('line-highlighter-html.resaltar') || {};
    const tagsConfig = atom.config.get('line-highlighter-html.tags') || {};
    if (Object.keys(configResaltar).length === 0) return;

    this.actualizarEstilos(configResaltar);

    atom.workspace.getTextEditors().forEach(editor => {
      this.aplicarResaltado(editor, configResaltar, tagsConfig);
    });

    const editorSub = atom.workspace.observeTextEditors(editor => {
      this.aplicarResaltado(editor, configResaltar, tagsConfig);
    });
    subscriptions.push(editorSub);

    const changeSub = atom.workspace.observeTextEditors(editor => {
      const disposable = editor.getBuffer().onDidStopChanging(() => {
        if (isEnabled) this.aplicarResaltado(editor, configResaltar, tagsConfig);
      });
      subscriptions.push(disposable);
    });
    subscriptions.push(changeSub);
  },

  aplicarResaltado(editor, configResaltar, tagsConfig) {
    let layer = decorations.get(editor);
    if (!layer) {
      layer = editor.addMarkerLayer();
      decorations.set(editor, layer);
    }
    layer.clear();

    const buffer = editor.getBuffer();
    const lines = buffer.getLineCount();

    const activeTags = Object.keys(tagsConfig).filter(tag => tagsConfig[tag]);

    for (let i = 0; i < lines; i++) {
      const linea = buffer.lineForRow(i);
      if (!linea) continue;

      for (const tag of activeTags) {
        const regex = new RegExp(`<\\s*${tag}\\b`, 'i');
        if (regex.test(linea)) {
          const range = buffer.rangeForRow(i);
          const marker = layer.markBufferRange(range, { invalidate: 'never' });

          const safeTag = tag.replace(/[^a-zA-Z0-9-]/g, '');
          editor.decorateMarker(marker, {
            type: 'text',
            class: `line-highlighter-html tag-${safeTag}`
          });

          break;
        }
      }
    }
  },

  limpiarTodo() {
    atom.workspace.getTextEditors().forEach(editor => {
      const layer = decorations.get(editor);
      if (layer) {
        layer.destroy();
        decorations.delete(editor);
      }
    });
  },

  actualizarEstilos(config) {
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'line-highlighter-html-styles';
      styleElement.textContent = '';
      document.head.appendChild(styleElement);
    }

    const sheet = styleElement.sheet;
    while (sheet.cssRules.length > 0) {
      sheet.deleteRule(0);
    }

    for (const tag in config) {
      if (!config.hasOwnProperty(tag)) continue;
      const safeTag = tag.replace(/[^a-zA-Z0-9-]/g, '');
      const estilo = config[tag];

			const rule = `
			  .line-highlighter-html.tag-${safeTag} {
			    background-color: ${estilo.background || 'transparent'} !important;
			    color: ${estilo.color || 'inherit'} !important;
			  }
			`;

			//border-left: ${estilo.borderLeft || 'none'} !important;
			//padding-left: 8px !important;

      try {
        sheet.insertRule(rule, sheet.cssRules.length);
      } catch (e) {}
    }
  }
};
