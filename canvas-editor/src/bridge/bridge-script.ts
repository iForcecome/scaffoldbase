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

  function inferLabel(el) {
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

  function parseDOMTree(el, depth) {
    if (depth > 10) return null;
    var tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta' || tag === 'br' || tag === 'hr') return null;
    var rect = el.getBoundingClientRect();
    if (rect.width < 2 && rect.height < 2) return null;
    if (tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'line' || tag === 'polyline' || tag === 'polygon' || tag === 'rect' || tag === 'g') {
      if (tag !== 'svg') return null;
      return { id: el.getAttribute(BRIDGE_ATTR) || '', tag: tag, label: 'Icon', rect: rectToObj(rect), children: [] };
    }
    var children = [];
    for (var i = 0; i < el.children.length; i++) {
      var node = parseDOMTree(el.children[i], depth + 1);
      if (node) children.push(node);
    }
    return {
      id: el.getAttribute(BRIDGE_ATTR) || '',
      tag: tag,
      label: inferLabel(el),
      rect: rectToObj(rect),
      children: children
    };
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
    var tree = parseDOMTree(body, 0);
    if (tree) {
      var pruned = pruneTree(tree.children, 1);
      parent.postMessage({ type: 'dom-tree', tree: pruned }, '*');
    }
  }

  function getElementById(id) {
    return document.querySelector('[' + BRIDGE_ATTR + '="' + id + '"]');
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
    var target = e.target.closest('[' + BRIDGE_ATTR + ']');
    if (target) {
      var id = target.getAttribute(BRIDGE_ATTR);
      var rect = target.getBoundingClientRect();
      parent.postMessage({
        type: 'element-click', id: id, rect: rectToObj(rect), label: inferLabel(target),
        shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey
      }, '*');
    }
  }, true);

  document.addEventListener('mousemove', function(e) {
    if (mode === 'preview') return;
    var target = e.target.closest('[' + BRIDGE_ATTR + ']');
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
          parent.postMessage({ type: 'computed-style', id: data.id, styles: styles, rect: rectToObj(rect5), label: inferLabel(el5) }, '*');
        }
        break;
      }
      case 'get-element-html': {
        var elH = getElementById(data.id);
        if (elH) {
          parent.postMessage({ type: 'element-html', id: data.id, html: elH.outerHTML, tag: elH.tagName.toLowerCase(), label: inferLabel(elH) }, '*');
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
          n.removeAttribute(BRIDGE_ATTR);
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
    parent.postMessage({ type: 'ready' }, '*');
    setTimeout(sendTree, 300);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 50);
  } else {
    window.addEventListener('load', init);
  }
})();
`
}
