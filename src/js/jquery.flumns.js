+function ( $, window) {

  var pluginName = 'flumns';
  
  var defaults = {
    align: 'justify',
    columnWidth: 292.5, 
    grid: true, 
    columnPrefix: "", 
    columnOffsetPrefix: "", 
    bindResize: true, 
    masonry: true, 
    // callbacks
    layout: null, 
    render: null, 
    itemsAdded: null
  };
  
  
  (function() {
    var lastTime = 0;
    var vendors = ['webkit', 'moz', 'o', 'ms'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame =
          window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
  }());


  
  
  function getClientRect(element) {
    // ie8 compatible
    var rect = element.getBoundingClientRect();
    var result = {};
    for (var x in rect) {
      result[x] = rect[x];
    }
    result.width = typeof(rect.width) == "number" ? rect.width : rect.right - rect.left;
    result.height = typeof(rect.height) == "number" ? rect.height : rect.bottom - rect.top;
    return result;
  }
  
  function Flumns(element, options) {
    
    var instance = this;
    
    var invalidateFlag = true;
    
    var $element = $(element);
    var columns = [];
    var items = [];
    var itemsAdded = false;
    
    // column count
    var _columnCount = 0;
    var _columnWidth = 0;
    
    // debug
    var execTime = 0;
    
    function isItem(elem) {
      return elem.nodeType == 1
        && $.inArray(elem.localName.toLowerCase(), ["br", "script", "link", "map"]) == -1
        || elem.nodeType == 3 && $.trim(elem.nodeValue);
    }
    
    this.indexOf = function(item) {
      for (var i = 0; i < items.length; i++) if (items[i] == item) return i;
    };
    
    this.get = function(index) {
      return items[index];
    };
    
    this.size = function() {
      return items.length;
    };
    
    this.add = function(item, index) {
      items.splice(index, 0, item);
      itemsAdded = true;
      this.invalidate();
    };
    
    // TODO: use document fragment for add all
    this.addAll = function(collection, index) {
      var invalidate = invalidateFlag;
      index = typeof index == 'number' ? index : this.size();
      invalidateFlag = false;
      for (var i = 0; i < collection.length; i++) {
        this.add(collection[i], index + i);
      }
      invalidateFlag = invalidate;
      if (invalidate) {
        this.invalidate();
      }
    };
    
    this.remove = function(item) {
      items.splice(this.indexOf(item), 1);
      $(item).remove();
      this.invalidate();
    };
    
    this.removeAll = function() {
      var invalidate = invalidateFlag;
      for (var i = 0; i < this.size(); i++) {
        invalidateFlag = false;
        this.remove(this.get(i));
        invalidateFlag = invalidate;
        i--;
      }
      if (invalidate) {
        this.invalidate();
      }
    };
    
    this.replaceAll = function(items) {
      var invalidate = invalidateFlag;
      invalidateFlag = false;
      this.removeAll();
      this.addAll(items);
      invalidateFlag = invalidate;
      if (invalidate) {
        this.invalidate();
      }
    };
    
    this.invalidate = function() {
      if (!invalidateFlag) return;
      _columnCount = 0;
      layout.call(this);
    };
    
    this.destroy = function() {
      $(window).unbind('resize', resizeHandler);
    };
    
    // TODO: has option changed (arrays)
    
    this.setOptions = function(obj) {
      var changed = false;
      invalidateFlag = false;
      for (var x in obj) {
        if (obj[x] != options[x]) {
          changed = true;
          this.setOption(x, obj[x]);
        }
        options[x] = obj[x];
      }
      invalidateFlag = true;
      if (changed) {
        this.invalidate();
      }
    };
    
    this.getOptions = function() {
      return options;
    };
    
    this.setOption = function(name, value) {
      var invalidate = invalidateFlag;
      if (options[name] != value) {
        // changed
        invalidateFlag = false;
        options[name] = value;
        // option specific behavior / invalidation
        switch (name) {
          case 'items': 
            this.replaceAll(value);
            break;
        }
        invalidateFlag = invalidate;
        if (invalidate) {
          this.invalidate();
        }
      }
    };
    
    this.getOption = function(name) {
      return options[name];
    };
    
    this.getColumnCount = function() {
      return _columnCount;
    };
    
    this.getColumnWidth = function() {
      return _columnWidth;
    };
    
    this.getExecTime = function() {
      return execTime;
    };
    
    function getGridClass(prefixOption, columnWeight) {
      var classes = [], columnPrefixes = typeof prefixOption == 'string' ? [prefixOption] : prefixOption;
      for (var i = 0; i < columnPrefixes.length; i++) classes.push(columnPrefixes[i] + columnWeight);
      return classes.join(" ");
    }
    
    function getColumnWidthOption() {
      var columnWidthOption = options.columnWidth;
      switch (typeof columnWidthOption) {
        case 'number': 
          return columnWidthOption;
        case 'string': 
          if (!isNaN(parseFloat(columnWidthOption))) {
            return parseFloat(columnWidthOption);
          }
        default: 
          // auto
          return defaults.columnWidth;
       }
    }
    
    function getGridOption() {
      var gridOption = options.grid;
      switch (typeof gridOption) {
        case 'number': 
          return parseInt(gridOption);
        case 'boolean': 
          return gridOption ? Flumns.GRID_BASE : 0;
        case 'string': 
          return gridOption == "true" ? Flumns.GRID_BASE : 0;
        case 'undefined': 
          return 0;
        default: 
          return Flumns.GRID_BASE;
      }
    }
    
    
    
    // heart of the plugin
    function layout() {
            
      console.time("layout");
      
      // layout
      
      var columnWidthOption = getColumnWidthOption();
      var gridOption = getGridOption();
      var align = options.align;
      
      var width = getClientRect(element).width;
      
      var columnFloat = width / columnWidthOption;
      var columnCount = columnFloat | 0;
      
      var columnOffset = columnFloat - columnCount;
      
      var columnWeightFloat = (gridOption || Flumns.GRID_BASE) / columnCount;
      var columnWeight = columnWeightFloat | 0;
      
      var columnWidth = columnWidthOption;
      
      if (align == "justify") {
        if (gridOption) {
          // adjust to grid column weight
          columnCount = gridOption / columnWeight;
        }
        columnWidth = width / columnCount;
      } else if (gridOption) {
        // adjust grid column weight
        columnWeight = gridOption / columnCount | 0;
        columnWidth = width / gridOption * columnWeight;
      }
      
      if (columnCount != _columnCount) {
      
        _columnCount = columnCount;
        _columnWidth = columnWidth;
        
        // setup columns
        
        for (var c = 0; c < columnCount; c++) {

          var column = columns[c] || {css: {}, className: '', height: 0};
          column.element = column.element || (function() {
            return $(document.createElement('div')); 
          })();

          var css = column.css;
            
          if (!gridOption || !options.columnPrefix) {
            css.width = align == "justify" ? 100 / columnCount + "%" : columnWidth + "px";
          } else {
            css.width = '';
          }
          
          if (options.columnPrefix) {
            css.display = '';
            css.verticalAlign = '';
            className = getGridClass(options.columnPrefix, columnWeight);
          } else {
            css.display = 'inline-block';
            css.verticalAlign = 'top';
          }
          column.css = css;
          column.className = className;
          
          columns[c] = column;
          
        }
        
        layoutItems();
        
      }
      
      // align columns
      var alignFloat = align == "center" ? 0.5 : align == "right" ? 1 : 0;
      var totalColumnWidth = this.getColumnWidth() * this.getColumnCount();
      for (var i = 0; i < columns.length; i++) {
        var column = columns[i];
        var x = (width - totalColumnWidth) * alignFloat;
        var css = column.css;
        if (x > 0) {
          css.position = 'relative';
          css.left = x + "px";
        } else {
          css.position = '';
          css.left = '';
        }
      }
      
      window.requestAnimationFrame(function() {
        // render
        renderColumns();
      });
      
      console.timeEnd("layout");
      
      // callback
      if (typeof options.layout  == 'function') {
        options.layout.call(this);
      }
    }
    
    function layoutItems() {
      var columnCount = instance.getColumnCount(); 
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var columnIndex = 0;
        columnIndex = i % columnCount;
        var column = columns[columnIndex];
        column.fragment = column.fragment || document.createDocumentFragment();
        column.fragment.appendChild(item);
      }
    }
    
    function layoutMasonry() {
      
      var columnCount = instance.getColumnCount(); 
      
      // reset column heights
      for (var c = 0; c < columns.length; c++) {
        columns[c].height = 0;
      }
        
      for (var i = 0; i < items.length; i++) {
          
         var item = items[i];
         var columnIndex = 0;
          
         if (i >= columnCount) {
           var minHeight = 0;
           for (var c = 0; c < columnCount; c++) {
             var column = columns[c];
             if (minHeight == 0 || column.height < minHeight) {
               minHeight = column.height;
               columnIndex = c;
             }
           }
         } else {
           columnIndex = i % columnCount;
         }
         
         var column = columns[columnIndex];
         column.height+= getClientRect(item).height;
         
         column.fragment = column.fragment || document.createDocumentFragment();
         column.fragment.appendChild(item);
         
      }
    }
    
    function renderColumns() {
      console.time("render");
      
      var columnCount = instance.getColumnCount();
      var len = Math.max(columnCount, columns.length);
      for (var c = 0; c < len; c++) {
        
        var column = columns[c];
        var columnElement = column.element;
        
        if (c > $element.children().length - 1) {
          $element.append(column.element);
        }
          
        if (c < columnCount) {
          
          columnElement.removeClass();
          columnElement.addClass(column.className);
          columnElement.css(column.css);
          
        } else {
          columnElement.remove();
        }
      }
      
      renderItems();
      
      if (options.masonry && columnCount > 1) {
        layoutMasonry();
        renderItems();
      }
      
      console.timeEnd("render");
      
      // callback
      if (itemsAdded) {
        if (typeof options.itemsAdded  == 'function') {
          options.itemsAdded.call(this);
        }
        itemsAdded = false;
      }
      
      
      if (typeof options.render  == 'function') {
        options.render.call(this);
      }
    }
    
    function renderItems() {
      
      var columnCount = instance.getColumnCount();
      for (var c = 0; c < columnCount; c++) {
        var column = columns[c];
        if (column.fragment) {
          column.element.append(column.fragment);
          column.fragment = null;
          
        }
      }
    }
    
    function resizeHandler(event) {
      layout.call(instance);
    }
    
    function init() {
      if (options.bindResize) {
        $(window).bind('resize', resizeHandler);
      }
      this.addAll($element.children());
    }
    
    init.call(this);
    
  };
  
  Flumns.GRID_BASE = 12;

  // bootstrap plugin
  var pluginClass = Flumns;
  $.fn[pluginName] = function(options) {
    options = $.extend({}, defaults, options);
    return this.each(function() {
      if (!$(this).data(pluginName)) {
          $(this).data(pluginName, new pluginClass(this, options));
      }
      return $(this);
    });
  };

}( jQuery, window );