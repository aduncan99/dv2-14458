// Inventory

define(['game', 'eventmachine'], function (game, eventMachine) {
  var setupSlots = function (inv) {
    var i, j;
    for (i = 0; i < inv.width; i++) {
      inv.slots[i] = [];
      for (j = 0; j < inv.height; j++) {
        inv.slots[i].push(null);
      }
    }
  };

  var checkRange = function (x, y, width, height, inv) {
    return x >= 0 &&
           y >= 0 &&
           width >= 0 &&
           height >= 0 &&
           x + width - 1 < inv.width &&
           y + height - 1 < inv.height;
  };

  var slotIterator = function (x, y, width, height, slots, callback) {
    var i, j, indexx, indexy;
    for (i = 0; i < width; i++) {
      for (j = 0; j < height; j++) {
        // drop out if the callback returns false
        indexx = i + x;
        indexy = j + y;
        if (callback(slots[indexx][indexy], indexx, indexy) === false) {
          return false;
        }
      }
    }
    return true;
  };


  var Inventory = function (width, height) {
    this.slots = [];
    this.items = [];
    this.width = width;
    this.height = height;
    setupSlots(this);
  };

  Inventory.prototype = {
    isAvailable: function (item, x, y) {
      return checkRange(x, y, item.width, item.height, this) &&
             slotIterator(x, y, item.width, item.height, this.slots, function (slot) {
               return !slot;
             });
    },

    // if the item at this position overlays a single object, return it
    // otherwise return null
    singleItemOverlay: function (item, x, y) {
      var found = null;
      if (checkRange(x, y, item.width, item.height, this)) {
        slotIterator(x, y, item.width, item.height, this.slots, function (slot) {
          if (found && slot && slot !== found) {
            return false;
          }
          found = slot;
        });
      }
      return found;
    },

    addItem: function (item, x, y) {
      if (this.isAvailable(item, x, y)) {
        var self = this;
        slotIterator(x, y, item.width, item.height, this.slots, function (slot, i, j) {
          self.slots[i][j] = item;
        });
        item.x = x;
        item.y = y;
        this.items.push(item);
        this.fireEvent('itemAdded', item);
      }
    },

    removeItemAt: function (x, y) {
      var item = this.slots[x][y];
      if (item) {
        this.removeItem(item);
      }
    },

    removeItem: function (item) {
      if (typeof(item.x) === 'number' && typeof(item.y) === 'number') {
        var self = this;
        slotIterator(item.x, item.y, item.width, item.height, this.slots, function (slot, i, j) {
          self.slots[i][j] = null;
        });
        this.items.splice(this.items.indexOf(item), 1);

        this.fireEvent('itemRemoved', item);

        item.x = null;
        item.y = null;
      }
    },

    itemAt: function (x, y) {
      return this.slots[x][y];
    }
  };

  eventMachine(Inventory);

  return Inventory;
});