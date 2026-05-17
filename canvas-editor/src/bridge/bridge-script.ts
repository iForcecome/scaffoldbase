export function getBridgeScript(): string {
  return `
(function() {
  var BRIDGE_ATTR = 'data-sf-id';
  var idCounter = 0;
  var mode = 'design';

  function assignIds(root) {
    var walk = function(el) {
      if (!el.getAttribute(BRIDGE_ATTR)) {
        el.setAttribute(BRIDGE_ATTR, 'sf-' + (idCounter++));
      }
      for (var i = 0; i < el.children.length; i++) {
        walk(el.children[i]);
      }
    };
    walk(root);
  }

  function getDirectText(el) {
    var t = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].textContent.trim();
    }
    return t.slice(0, 24);
  }

  function inferSemantic(el) {
    var tag = el.tagName.toLowerCase();
    var text = (el.textContent || '').trim();

    if (tag === 'header') return { component: 'PageHeader', role: 'header', label: '页面标题区' };
    if (tag === 'nav') return { component: 'Navigation', role: 'navigation', label: '导航菜单' };
    if (tag === 'form') return { component: 'FormSection', role: 'form', label: '表单区' };
    if (tag === 'table') return { component: 'DataTable', role: 'table', label: '数据表格' };
    if (tag === 'button') return { component: 'Button', role: 'action', label: getDirectText(el) || '按钮' };

    if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
      return { component: null, role: 'title', label: getDirectText(el) || '标题' };
    }

    if (tag === 'p') {
      return { component: null, role: 'description', label: getDirectText(el) || '描述' };
    }

    if (tag === 'div' || tag === 'section' || tag === 'main' || tag === 'article') {
      if (el.querySelector(':scope > table') || el.querySelector('table')) {
        return { component: 'DataTable', role: 'table', label: '数据表格' };
      }

      var hasField = !!el.querySelector('input, select, textarea');
      var buttons = el.querySelectorAll('button');
      var hasSearchText = text.indexOf('搜索') >= 0 || text.indexOf('筛选') >= 0 || text.indexOf('重置') >= 0 || text.indexOf('状态') >= 0 || text.indexOf('日期') >= 0;
      if ((hasField && buttons.length > 0) || (hasSearchText && buttons.length >= 1)) {
        return { component: 'FilterBar', role: 'filters', label: '筛选区' };
      }

      var directTitle = el.querySelector(':scope > h1, :scope > h2, :scope > h3');
      if (directTitle && buttons.length > 0) {
        return { component: 'PageHeader', role: 'header', label: '页面标题区' };
      }

      if (el.querySelector('label') && el.querySelector('input, select, textarea')) {
        return { component: 'FormSection', role: 'form', label: '表单区' };
      }

      if ((text.indexOf('暂无') >= 0 || text.indexOf('没有') >= 0) && buttons.length <= 1) {
        return { component: 'EmptyState', role: 'empty-state', label: '空状态' };
      }
    }

    return { component: null, role: null, label: null };
  }

  function isGenericLabel(label) {
    return !label || label === '容器' || label === '空容器' || label === 'Section' || label === 'Aside' || label === 'Region';
  }

  function applySemanticAttrs(el) {
    var inferred = inferSemantic(el);
    var component = el.getAttribute('data-sf-component') || inferred.component;
    var role = el.getAttribute('data-sf-role') || inferred.role;
    var label = el.getAttribute('data-sf-label') || inferred.label || inferLabel(el);

    if (component) {
      el.setAttribute('data-sf-component', component);
      if (!el.getAttribute('data-sf-variant')) el.setAttribute('data-sf-variant', 'default');
      var baseClass = 'sf-' + toKebab(component);
      var variantClass = baseClass + '--' + toKebab(el.getAttribute('data-sf-variant') || 'default');
      if (!el.classList.contains(baseClass)) el.classList.add(baseClass);
      if (!el.classList.contains(variantClass)) el.classList.add(variantClass);
    }

    if (role && !el.getAttribute('data-sf-role')) {
      el.setAttribute('data-sf-role', role);
    }

    if (label && !isGenericLabel(label) && !el.getAttribute('data-sf-label')) {
      el.setAttribute('data-sf-label', label);
    }
  }

  function upgradeSemanticAttributes(root) {
    var stack = [root];
    while (stack.length) {
      var current = stack.pop();
      if (!current || current.nodeType !== 1) continue;
      var el = current;
      if (el.getAttribute && el.getAttribute(BRIDGE_ATTR)) {
        applySemanticAttrs(el);
      }
      for (var i = 0; i < el.children.length; i++) {
        stack.push(el.children[i]);
      }
    }
  }

  function getSemanticMeta(el) {
    var inferred = inferSemantic(el);
    return {
      sfId: el.getAttribute(BRIDGE_ATTR) || null,
      semanticLabel: el.getAttribute('data-sf-label') || inferred.label || null,
      component: el.getAttribute('data-sf-component') || inferred.component || null,
      role: el.getAttribute('data-sf-role') || inferred.role || null,
      variant: el.getAttribute('data-sf-variant') || null,
      specPath: el.getAttribute('data-sf-spec') || null
    };
  }

  function inferLabel(el) {
    var semanticLabel = el.getAttribute('data-sf-label');
    if (semanticLabel) return semanticLabel;

    var tag = el.tagName.toLowerCase();

    if (tag === 'body') return '页面根';
    if (tag === 'header') return 'Header';
    if (tag === 'nav') return '导航菜单';
    if (tag === 'main') return '主内容区';
    if (tag === 'footer') return 'Footer';
    if (tag === 'section') return 'Section';
    if (tag === 'aside') return 'Aside';
    if (tag === 'form') return 'Form';
    if (tag === 'table') return '数据表格';
    if (tag === 'thead') return '表头行';
    if (tag === 'tbody') return '数据行';
    if (tag === 'tr') return '行';
    if (tag === 'ul' || tag === 'ol') return '列表';
    if (tag === 'img') return '图片';
    if (tag === 'svg') return 'Icon';

    var directText = getDirectText(el);
    var fullText = (el.textContent || '').trim();

    if (tag === 'h1') return directText || '标题';
    if (tag === 'h2') return directText || '副标题';
    if (tag === 'h3') return directText || '小标题';
    if (tag === 'p') return directText || '段落';
    if (tag === 'span') return directText || '文本';
    if (tag === 'button') return directText || '按钮';
    if (tag === 'a') return directText || '链接';
    if (tag === 'input') return '输入框[' + (el.type || 'text') + ']';
    if (tag === 'select') return '下拉选择';
    if (tag === 'label') return directText || '标签';
    if (tag === 'th') return directText || '表头';
    if (tag === 'td') return directText || '单元格';
    if (tag === 'li') return directText || '列表项';

    if (tag === 'div') {
      var hasH1 = el.querySelector('h1, h2');
      var directBtns = el.querySelectorAll(':scope > button');
      var directH = el.querySelector(':scope > h1, :scope > h2, :scope > h3');
      var allBtns = el.querySelectorAll('button');

      if (/共.*?\\d+.*?条/.test(fullText) && allBtns.length >= 3) return '分页器';

      if (hasH1 && el.querySelector('button')) return '标题栏';

      if (directH) {
        var hText = directH.textContent.trim().slice(0, 16);
        return hText || '标题区';
      }

      if (el.querySelector(':scope > table')) return '表格容器';

      if (directBtns.length >= 3) return '页码';
      if (directBtns.length >= 2) {
        if (el.children.length > directBtns.length) return '筛选栏';
        return '操作按钮组';
      }

      if (fullText.indexOf('搜索') >= 0 && fullText.length < 40) return '搜索框';

      var isInHeader = false;
      var anc = el.parentElement;
      while (anc && anc !== document.body) {
        if (anc.tagName.toLowerCase() === 'header') { isInHeader = true; break; }
        anc = anc.parentElement;
      }

      if (el.children.length <= 3 && el.querySelector('svg, img')) {
        if (isInHeader && fullText.length > 0 && fullText.length <= 16) return 'Logo';
        if (fullText.length > 0 && fullText.length <= 16) return fullText;
      }

      if (directText.length > 0 && directText.length <= 20) return directText;

      if (el.children.length === 0 && fullText) return fullText.slice(0, 16);
      if (el.children.length === 0) return '空容器';

      if (el.children.length === 1) {
        var onlyChild = el.children[0];
        var childTag = onlyChild.tagName.toLowerCase();
        if (childTag === 'input') return '输入框容器';
        if (childTag === 'select') return '选择框容器';
      }

      return '容器';
    }

    return tag;
  }

  function rectToObj(r) {
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }

  function isDecorativeElement(el) {
    var tag = el.tagName.toLowerCase();
    if (tag !== 'div' && tag !== 'span') return false;
    if ((el.textContent || '').trim()) return false;
    if (el.querySelector('img, svg, canvas, input, select, textarea, button, a')) return false;

    var style = window.getComputedStyle(el);
    var className = el.getAttribute('class') || '';
    var isOverlay = style.position === 'absolute' ||
      style.position === 'fixed' ||
      className.indexOf('absolute') >= 0 ||
      className.indexOf('inset-0') >= 0;
    var isFaint = parseFloat(style.opacity || '1') <= 0.25 || className.indexOf('opacity-') >= 0;
    return isOverlay && isFaint;
  }

  function resolveSelectableTarget(el) {
    var target = el.closest('[' + BRIDGE_ATTR + ']');
    while (target && target.parentElement && target.tagName.toLowerCase() !== 'body') {
      if (!isDecorativeElement(target)) return target;
      target = target.parentElement.closest('[' + BRIDGE_ATTR + ']') || target.parentElement;
    }
    return target;
  }

  function parseDOMTree(el, depth) {
    if (depth > 10) return null;
    var tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'br' || tag === 'hr') return null;
    if (isDecorativeElement(el)) return null;
    var rect = el.getBoundingClientRect();
    if (rect.width < 2 && rect.height < 2) return null;
    if (tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'line' || tag === 'polyline' || tag === 'polygon' || tag === 'rect' || tag === 'g') {
      if (tag !== 'svg') return null;
      return Object.assign({ id: el.getAttribute(BRIDGE_ATTR) || '', tag: tag, label: inferLabel(el), rect: rectToObj(rect), children: [] }, getSemanticMeta(el));
    }
    var children = [];
    for (var i = 0; i < el.children.length; i++) {
      var node = parseDOMTree(el.children[i], depth + 1);
      if (node) children.push(node);
    }
    return Object.assign({
      id: el.getAttribute(BRIDGE_ATTR) || '',
      tag: tag,
      label: inferLabel(el),
      rect: rectToObj(rect),
      children: children
    }, getSemanticMeta(el));
  }

  function pruneTree(nodes, depth) {
    if (!nodes || !nodes.length) return [];
    var result = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var tag = node.tag;

      if (tag === 'svg' || tag === 'input' || tag === 'th' || tag === 'td' || tag === 'tr') continue;

      if (depth >= 3 && (tag === 'span' || tag === 'a' || tag === 'p' || tag === 'button' || tag === 'label')) continue;

      var children = pruneTree(node.children, depth + 1);

      if (tag === 'div' && children.length === 1) {
        var child = children[0];
        var generic = ['容器', '空容器', '表格容器', '输入框容器', '选择框容器'];
        var label = generic.indexOf(node.label) >= 0 ? child.label : node.label;
        result.push({ id: node.id, tag: child.tag, label: label, rect: node.rect, children: child.children });
        continue;
      }

      if (tag === 'nav') children = [];

      if (tag === 'thead') {
        node.label = '表头行';
        children = [];
      }

      if (tag === 'tbody') {
        var trCount = 0;
        for (var j = 0; j < node.children.length; j++) {
          if (node.children[j].tag === 'tr') trCount++;
        }
        node.label = trCount > 1 ? '数据行 ×' + trCount : '数据行';
        children = [];
      }

      node.children = children;
      result.push(node);
    }
    return result;
  }

  function sendTree() {
    var body = document.body;
    if (!body) return;
    assignIds(body);
    upgradeSemanticAttributes(body);
    var tree = parseDOMTree(body, 0);
    if (tree) {
      var pruned = pruneTree(tree.children, 1);
      parent.postMessage({ type: 'dom-tree', tree: pruned }, '*');
    }
  }

  function getElementById(id) {
    return document.querySelector('[' + BRIDGE_ATTR + '="' + id + '"]');
  }

  function toKebab(value) {
    return String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  function applyStyles(el, styles) {
    var entries = Object.entries(styles || {});
    for (var i = 0; i < entries.length; i++) {
      var prop = toKebab(entries[i][0]);
      var value = entries[i][1];
      el.style.setProperty(prop, String(value));
    }
  }

  function applyOperation(op) {
    if (!op || !op.type) throw new Error('Invalid operation');

    if (op.type === 'replaceText') {
      var textEl = getElementById(op.target);
      if (!textEl) throw new Error('Target not found: ' + op.target);
      textEl.textContent = String(op.text || '');
      return;
    }

    if (op.type === 'updateStyle') {
      var styleEl = getElementById(op.target);
      if (!styleEl) throw new Error('Target not found: ' + op.target);
      applyStyles(styleEl, op.styles);
      return;
    }

    if (op.type === 'replaceClass') {
      var classEl = getElementById(op.target);
      if (!classEl) throw new Error('Target not found: ' + op.target);
      classEl.className = String(op.className || '');
      return;
    }

    if (op.type === 'setVariant') {
      var variantEl = getElementById(op.target);
      if (!variantEl) throw new Error('Target not found: ' + op.target);
      var inferred = inferSemantic(variantEl);
      var component = variantEl.getAttribute('data-sf-component') || inferred.component;
      if (!component) throw new Error('Target has no data-sf-component: ' + op.target);
      var baseClass = 'sf-' + toKebab(component);
      var nextVariant = String(op.variant || 'default');
      var nextVariantClass = baseClass + '--' + toKebab(nextVariant);
      var classes = Array.prototype.slice.call(variantEl.classList).filter(function(cls) {
        return cls.indexOf(baseClass + '--') !== 0;
      });
      if (classes.indexOf(baseClass) < 0) classes.push(baseClass);
      classes.push(nextVariantClass);
      variantEl.className = classes.join(' ');
      variantEl.setAttribute('data-sf-component', component);
      if (!variantEl.getAttribute('data-sf-role') && inferred.role) variantEl.setAttribute('data-sf-role', inferred.role);
      if (!variantEl.getAttribute('data-sf-label') && inferred.label) variantEl.setAttribute('data-sf-label', inferred.label);
      variantEl.setAttribute('data-sf-variant', nextVariant);
      return;
    }

    throw new Error('Unsupported operation: ' + op.type);
  }

  document.addEventListener('click', function(e) {
    if (mode === 'preview') {
      var link = e.target.closest('a[href]');
      if (link) {
        var href = link.getAttribute('href');
        if (href && href.indexOf('#page:') === 0) {
          e.preventDefault();
          parent.postMessage({ type: 'navigate-page', pageId: href.slice(6) }, '*');
        } else {
          e.preventDefault();
        }
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    var target = resolveSelectableTarget(e.target);
    if (target) {
      var id = target.getAttribute(BRIDGE_ATTR);
      var rect = target.getBoundingClientRect();
      parent.postMessage(Object.assign({
        type: 'element-click', id: id, rect: rectToObj(rect), label: inferLabel(target),
        shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey
      }, getSemanticMeta(target)), '*');
    }
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (mode === 'preview') return;
    var target = resolveSelectableTarget(e.target);
    if (target) {
      var id = target.getAttribute(BRIDGE_ATTR);
      var rect = target.getBoundingClientRect();
      parent.postMessage({ type: 'element-hover', id: id, rect: rectToObj(rect) }, '*');
    }
  }, true);

  document.addEventListener('mouseleave', function() {
    if (mode === 'preview') return;
    parent.postMessage({ type: 'element-hover', id: null, rect: null }, '*');
  });

  document.addEventListener('wheel', function(e) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      parent.postMessage({
        type: 'iframe-wheel',
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey
      }, '*');
    }
  }, { passive: false, capture: true });

  document.addEventListener('dblclick', function(e) {
    if (mode === 'preview') return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  window.addEventListener('message', function(e) {
    var data = e.data;
    if (!data || !data.type) return;
    switch (data.type) {
      case 'update-style': {
        var el = getElementById(data.id);
        if (el) {
          Object.assign(el.style, data.styles);
          var rect = el.getBoundingClientRect();
          parent.postMessage({ type: 'element-rect-update', id: data.id, rect: rectToObj(rect) }, '*');
          sendTree();
        }
        break;
      }
      case 'execute-operations': {
        var operations = Array.isArray(data.operations) ? data.operations : [];
        var errors = [];
        for (var opIndex = 0; opIndex < operations.length; opIndex++) {
          try {
            applyOperation(operations[opIndex]);
          } catch (err) {
            errors.push(err && err.message ? err.message : String(err));
          }
        }
        sendTree();
        parent.postMessage({ type: 'operation-result', ok: errors.length === 0, errors: errors }, '*');
        break;
      }
      case 'update-text': {
        var el2 = getElementById(data.id);
        if (el2) { el2.textContent = data.text; sendTree(); }
        break;
      }
      case 'get-rect': {
        var el3 = getElementById(data.id);
        if (el3) {
          var rect3 = el3.getBoundingClientRect();
          parent.postMessage({ type: 'element-rect', id: data.id, rect: rectToObj(rect3) }, '*');
        }
        break;
      }
      case 'get-computed-style': {
        var el5 = getElementById(data.id);
        if (el5) {
          var cs = window.getComputedStyle(el5);
          var styles = {};
          var props = ['display','flex-direction','justify-content','align-items','gap','width','height','min-width','max-width','padding','margin','font-size','font-weight','font-family','color','background-color','border-radius','border','overflow'];
          for (var i = 0; i < props.length; i++) {
            styles[props[i]] = cs.getPropertyValue(props[i]);
          }
          var rect5 = el5.getBoundingClientRect();
          parent.postMessage(Object.assign({ type: 'computed-style', id: data.id, styles: styles, rect: rectToObj(rect5), label: inferLabel(el5) }, getSemanticMeta(el5)), '*');
        }
        break;
      }
      case 'get-element-html': {
        var elH = getElementById(data.id);
        if (elH) {
          parent.postMessage(Object.assign({ type: 'element-html', id: data.id, html: elH.outerHTML, tag: elH.tagName.toLowerCase(), label: inferLabel(elH) }, getSemanticMeta(elH)), '*');
        }
        break;
      }
      case 'replace-element-html': {
        var elR = getElementById(data.id);
        if (elR && data.html) {
          var wrapper = document.createElement('div');
          wrapper.innerHTML = data.html;
          var newEl = wrapper.firstElementChild;
          if (newEl) {
            elR.parentNode.replaceChild(newEl, elR);
            assignIds(newEl);
            upgradeSemanticAttributes(newEl);
            sendTree();
            var newRect = newEl.getBoundingClientRect();
            var newId = newEl.getAttribute(BRIDGE_ATTR);
            parent.postMessage({ type: 'element-replaced', id: newId, rect: rectToObj(newRect) }, '*');
          }
        }
        break;
      }
      case 'get-page-html': {
        var clone = document.documentElement.cloneNode(true);
        clone.querySelectorAll('[' + BRIDGE_ATTR + ']').forEach(function(n) {
          var id = n.getAttribute(BRIDGE_ATTR);
          if (id && /^sf-\\d+$/.test(id)) n.removeAttribute(BRIDGE_ATTR);
        });
        var bridgeScripts = clone.querySelectorAll('script');
        bridgeScripts.forEach(function(s) {
          if (s.textContent && s.textContent.indexOf('data-sf-id') >= 0) s.remove();
        });
        clone.querySelectorAll('style').forEach(function(s) {
          if (s.textContent && (s.textContent.indexOf('tailwindcss v') >= 0 || s.textContent.indexOf('--tw-border-spacing') >= 0)) {
            s.remove();
          }
        });
        parent.postMessage({ type: 'page-html', html: '<!DOCTYPE html>\\n' + clone.outerHTML }, '*');
        break;
      }
      case 'start-edit': {
        var elEdit = getElementById(data.id);
        if (elEdit) {
          elEdit.contentEditable = 'true';
          elEdit.focus();
          var sel = window.getSelection();
          var range = document.createRange();
          range.selectNodeContents(elEdit);
          sel.removeAllRanges();
          sel.addRange(range);
          var onBlur = function() {
            elEdit.removeEventListener('blur', onBlur);
            elEdit.removeEventListener('keydown', onKey);
            elEdit.contentEditable = 'false';
            sendTree();
            parent.postMessage({ type: 'edit-done', id: data.id }, '*');
          };
          var onKey = function(ev) {
            if (ev.key === 'Escape') {
              ev.preventDefault();
              elEdit.blur();
            }
          };
          elEdit.addEventListener('blur', onBlur);
          elEdit.addEventListener('keydown', onKey);
        }
        break;
      }
      case 'reorder-element': {
        var elReorder = getElementById(data.id);
        var targetParent = data.parentId ? getElementById(data.parentId) : document.body;
        if (elReorder && targetParent && elReorder.parentNode === targetParent) {
          var refEl = data.insertBeforeId ? getElementById(data.insertBeforeId) : null;
          targetParent.insertBefore(elReorder, refEl);
          sendTree();
          parent.postMessage({ type: 'reorder-done' }, '*');
        }
        break;
      }
      case 'request-tree': {
        sendTree();
        break;
      }
      case 'set-mode': {
        mode = data.mode || 'design';
        break;
      }
    }
  });

  function init() {
    if (document.body) assignIds(document.body);
    if (document.body) upgradeSemanticAttributes(document.body);
    parent.postMessage({ type: 'ready' }, '*');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    requestAnimationFrame(init);
  } else {
    window.addEventListener('load', init);
  }
})();
`
}
