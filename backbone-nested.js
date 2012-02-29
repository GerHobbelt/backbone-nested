/**
 * Backbone-Nested 1.0.3 - An extension of Backbone.js that keeps track of nested attributes
 *
 * http://afeld.github.com/backbone-nested/
 *
 * Copyright (c) 2011-2012 Aidan Feldman
 * MIT Licensed (LICENSE)
 */
Backbone.NestedModel = Backbone.Model.extend({

  get: function(attrStrOrPath, opts){
    opts || (opts = {});

    var attrPath = Backbone.NestedModel.attrPath(attrStrOrPath),
      childAttr = attrPath[0],
      result = Backbone.NestedModel.__super__.get.call(this, childAttr);
    
    // walk through the child attributes
    for (var i = 1; i < attrPath.length; i++){
      if (!result){
        // value not present
        break;
      }
      childAttr = attrPath[i];
      result = result[childAttr];
    }

    // check if the result is an Object, Array, etc.
    if (!opts.silent && _.isObject(result) && window.console){
      window.console.log("Backbone-Nested syntax is preferred for accesing values of attribute '" + attrStrOrPath + "'.");
    }
    // else it's a leaf

    return result;
  },

  has: function(attr){
    // for some reason this is not how Backbone.Model is implemented - it accesses the attributes object directly
    var result = this.get(attr, {silent: true});
    return !(result === null || _.isUndefined(result));
  },

  set: function(key, value, opts){
    var attrs;
    if (_.isObject(key) || key == null) {
      attrs = key;
      opts = value;
    } else {
      attrs = {};
      attrs[key] = value;
    }
    opts = opts || {};

    var newAttrs = _.deepClone(this.attributes);
    
    for (var attrStr in attrs){
      var attrPath = Backbone.NestedModel.attrPath(attrStr),
        attrObj = Backbone.NestedModel.createAttrObj(attrPath, attrs[attrStr]);

      this._mergeAttrs(newAttrs, attrObj, opts);
    }

    return Backbone.NestedModel.__super__.set.call(this, newAttrs, opts);
  },

  unset: function(attrStr, opts){
    opts = _.extend({}, opts, {unset: true});
    this.set(attrStr, null, opts);

    return this;
  },

  remove: function(attrStr, opts){
    var attrPath = Backbone.NestedModel.attrPath(attrStr),
      val = this.get(_.initial(attrPath)),
      i = _.last(attrPath);

    if (!_.isArray(val)){
      throw new Error("remove() must be called on a nested array");
    }

    // remove the element from the array
    val.splice(i, 1);
    this.set(attrStr, val, opts);

    return this;
  },

  toJSON: function(){
    var json = Backbone.NestedModel.__super__.toJSON.apply(this);
    return _.deepClone(json);
  },


  // private

  _mergeAttrs: function(dest, source, opts, stack){
    stack || (stack = []);

    _.each(source, function(sourceVal, prop){
      if (prop === '-1'){
        prop = dest.length;
      }

      var destVal = dest[prop],
        newStack = stack.concat([prop]),
        attrStr;

      var isChildAry = _.isObject(sourceVal) && _.any(sourceVal, function(val, attr){
        return attr === '-1' || _.isNumber(attr);
      });

      if (isChildAry && !_.isArray(destVal)){
        destVal = dest[prop] = [];
      }

      if (prop in dest && _.isObject(sourceVal) && _.isObject(destVal)){
        destVal = dest[prop] = this._mergeAttrs(destVal, sourceVal, opts, newStack);
      } else {
        var oldVal = destVal;

        destVal = dest[prop] = sourceVal;

        if (_.isArray(dest) && !opts.silent){
          attrStr = Backbone.NestedModel.createAttrStr(stack);

          if (!oldVal && destVal){
            this.trigger('add:' + attrStr, this, destVal);
          } else if (oldVal && !destVal){
            this.trigger('remove:' + attrStr, this, oldVal);
          }
        }
      }
      
      // let the superclass handle change events for top-level attributes
      if (!opts.silent && newStack.length > 1){
        attrStr = Backbone.NestedModel.createAttrStr(newStack);
        this.trigger('change:' + attrStr, this, destVal);
      }
    }, this);

    return dest;
  }

}, {
  // class methods

  attrPath: function(attrStrOrPath){
    var path;
    
    if (_.isString(attrStrOrPath)){
      // change all appends to '-1'
      attrStrOrPath = attrStrOrPath.replace(/\[\]/g, '[-1]');
      // TODO this parsing can probably be more efficient
      path = (attrStrOrPath === '') ? [''] : attrStrOrPath.match(/[^\.\[\]]+/g);
      path = _.map(path, function(val){
        // convert array accessors to numbers
        return val.match(/^\d+$/) ? parseInt(val) : val;
      });
    } else {
      path = attrStrOrPath;
    }

    return path;
  },

  createAttrObj: function(attrStrOrPath, val){
    var attrPath = this.attrPath(attrStrOrPath),
      newVal;

    switch (attrPath.length){
      case 0:
        throw "no valid attributes: '" + attrStrOrPath + "'";
        break;
      
      case 1: // leaf
        newVal = val;
        break;
      
      default: // nested attributes
        var otherAttrs = _.rest(attrPath);
        newVal = this.createAttrObj(otherAttrs, val);
        break;
    }

    var childAttr = attrPath[0],
      result = _.isNumber(childAttr) ? [] : {};
    
    result[childAttr] = newVal;
    return result;
  },

  createAttrStr: function(attrPath){
    var attrStr = attrPath[0];
    _.each(_.rest(attrPath), function(attr){
      attrStr += _.isNumber(attr) ? ('[' + attr + ']') : ('.' + attr);
    });

    return attrStr;
  }

});


_.mixin({

  deepClone: function(obj){
    var result = _.clone(obj); // shallow clone
    if (_.isObject(obj)){
      _.each(obj, function(val, key){
        result[key] = _.deepClone(val);
      });
    }
    return result;
  }

});
