// Sprite

define(["game", "Matrix", "Vector", "spriteMarshal", "Sprite-info"], function (game, Matrix, Vector, spriteMarshal, spriteInfo) {

  var Matrix   = new Matrix(2, 3);
  var context  = game.spriteContext;

  var Sprite = function () {
    this.children = {};

    this.visible  = true;
    this.reap     = false;

    this.collidable = false;

    this.scale = 1;

    this.currentNode = null;
    this.nextsprite  = null;
  };

  Sprite.prototype.init = function (name) {
    var config = spriteInfo[name];

    this.name   = name;

    var co;
    if (config.collidableOffset) {
      co = config.collidableOffset;
    } else {
      // if not configured assume it's centered
      co = new Vector(config.width / 2, config.height / 2);
    }
    this.points = [
      new Vector(-co.x, -co.y),
      new Vector( co.x, -co.y),
      new Vector(-co.x,  co.y),
      new Vector( co.x,  co.y)
    ];

    // assuming horizontal tiles
    this.tileWidth  = config.width;
    this.tileHeight = config.height;

    // cloned so we can manipulate it on a per-sprite instance basis
    this.imageOffset = $.extend({}, config.imageOffset);
    this.center      = $.extend({}, config.center);

    // load the image
    game.assetManager.loadImage(config.img, $.proxy(function (img) {
      this.image = img;
    }, this));

    this.pos = new Vector(0, 0);
    this.pos.rot = 0;

    this.vel = new Vector(0, 0);
    this.vel.rot = 0;

    this.acc = new Vector(0, 0);
    this.acc.rot = 0;

    // for now we're going to assume all sprites are boxes
    // TODO calculate the normals for arbitrary shapes
    this.normals = [
      new Vector(1, 0),
      new Vector(0, 1)
    ];

    this.currentNormals = [
      new Vector(1, 0),
      new Vector(0, 1)
    ];

    this.z = config.z;
  };

  Sprite.prototype.preMove  = function () {
  };

  Sprite.prototype.postMove = function () {
  };

  Sprite.prototype.run = function (delta) {
    this.transPoints = null; // clear cached points
    this.preMove(delta);
    this.move(delta);
    this.postMove(delta);
    this.transformNormals();
    this.updateGrid();
  };

  Sprite.prototype.move = function (delta) {
    if (!this.visible) return;

    this.vel.x   += this.acc.x   * delta;
    this.vel.y   += this.acc.y   * delta;
    this.vel.rot += this.acc.rot * delta;
    this.pos.x   += this.vel.x   * delta;
    this.pos.y   += this.vel.y   * delta;
    this.pos.rot += this.vel.rot * delta;

    if (this.pos.rot > 360) {
      this.pos.rot -= 360;
    } else if (this.pos.rot < 0) {
      this.pos.rot += 360;
    }
  };

  // TODO: cache these
  Sprite.prototype.transformNormals = function () {
    // only rotate
    Matrix.configure(this.pos.rot, 1.0, 0, 0);
    for (var i = 0; i < this.normals.length; i++) {
      this.currentNormals[i] = Matrix.vectorMultiply(this.normals[i]);
    }
  };

  Sprite.prototype.render = function (delta) {
    if (!this.visible) return;

    context.save();
    this.configureTransform(context);
    this.draw(delta);

    context.restore();
  };

  // default draw method, just draw the 0th tile
  Sprite.prototype.draw = function (delta) {
    this.drawTile(0);
  };

  Sprite.prototype.updateGrid = function () {
    if (!this.visible) return;
    var newNode = game.map.getNodeByWorldCoords(this.pos.x, this.pos.y);

    // we're off the the part of the world loaded into memory
    if (!newNode) {
      this.die();
      return;
    }

    if (newNode != this.currentNode) {
      if (this.currentNode) {
        this.currentNode.leave(this);
      }
      newNode.enter(this);
      this.currentNode = newNode;
    }
  };

  Sprite.prototype.configureTransform = function (ctx) {
    if (!this.visible) return;

    var rad = (this.pos.rot * Math.PI)/180;

    ctx.translate(this.pos.x, this.pos.y);
    ctx.translate(-game.map.originOffsetX, -game.map.originOffsetY);
    ctx.rotate(rad);
    ctx.scale(this.scale, this.scale);
  };

  Sprite.prototype.collision = function () {
  };

  Sprite.prototype.die = function () {
    this.visible = false;
    this.reap = true;
    if (this.currentNode) {
      this.currentNode.leave(this);
      this.currentNode = null;
    }
  };

  // TODO perhaps cache transpoints Vectors?
  Sprite.prototype.transformedPoints = function () {
    if (this.transPoints) return this.transPoints;
    var trans = [];
    Matrix.configure(this.pos.rot, this.scale, this.pos.x, this.pos.y);
    var count = this.points.length;
    for (var i = 0; i < count; i++) {
      trans[i] = Matrix.vectorMultiply(this.points[i]);
    }
    this.transPoints = trans; // cache translated points
    return trans;
  };

  Sprite.prototype.isClear = function (pos) {
    pos = pos || this.pos;
    var cn = this.currentNode;
    if (cn == null) {
      var gridx = Math.floor(pos.x / game.gridsize);
      var gridy = Math.floor(pos.y / game.gridsize);
      gridx = (gridx >= game.map.grid.length) ? 0 : gridx;
      gridy = (gridy >= game.map.grid[0].length) ? 0 : gridy;
      cn = game.map.grid[gridx][gridy];
    }
    return (cn.isEmpty(this.collidesWith) &&
            cn.north.isEmpty(this.collidesWith) &&
            cn.south.isEmpty(this.collidesWith) &&
            cn.east.isEmpty(this.collidesWith) &&
            cn.west.isEmpty(this.collidesWith) &&
            cn.north.east.isEmpty(this.collidesWith) &&
            cn.north.west.isEmpty(this.collidesWith) &&
            cn.south.east.isEmpty(this.collidesWith) &&
            cn.south.west.isEmpty(this.collidesWith));
  };

  // TODO handle vertical offsets
  Sprite.prototype.drawTile = function (index, flipped, cxt) {
    if (!this.image) return;
    cxt = cxt || context;
    if (flipped) {
      cxt.save();
      cxt.scale(-1, 1);
    }
    cxt.drawImage(this.image,
                  this.imageOffset.x + index * this.tileWidth,
                  this.imageOffset.y,
                  this.tileWidth,
                  this.tileHeight,
                  -this.center.x,
                  -this.center.y,
                  this.tileWidth,
                  this.tileHeight);
    if (flipped) {
      cxt.restore();
    }
  };

  Sprite.prototype.nearby = function () {
    if (this.currentNode == null) return [];
    return _(this.currentNode.nearby()).without(this);
  };

  Sprite.prototype.distance = function (other) {
    return Math.sqrt(Math.pow(other.pos.x - this.pos.x, 2) + Math.pow(other.pos.y - this.pos.y, 2));
  };

  Sprite.prototype.canSee = function (other) {
    if (this.currentNode === other.currentNode) {
      // in the same cell
      return true;
    }

    var TILE_WIDTH = game.gridSize;

    // where are they
    var x0 = Math.floor((this.pos.x)  / TILE_WIDTH);
    var y0 = Math.floor((this.pos.y)  / TILE_WIDTH);
    var x1 = Math.floor((other.pos.y) / TILE_WIDTH);
    var y1 = Math.floor((other.pos.y) / TILE_WIDTH);

    var X = x0;
    var Y = y0;

    var node = this.currentNode;

    var dx = other.pos.x - this.pos.x;
    var dy = other.pos.y - this.pos.y;
    var len = Math.sqrt(dx*dx + dy*dy);
    if (len != 0) {
      dx /= len;
      dy /= len;
    }

    var stepX, tMaxX, tDeltaX,
        stepY, tMaxY, tDeltaY;

    if (dx < 0) {
      stepX   = -1;
      tMaxX   = (((x0)*TILE_WIDTH) - this.pos.x) / dx;
      tDeltaX = TILE_WIDTH / -dx;
    } else if (0 < dx) {
      stepX   = 1;
      tMaxX   = (((x0+1)*TILE_WIDTH) - this.pos.x) / dx;
      tDeltaX = TILE_WIDTH / dx;
    } else {
      // dx is 0, we should only walk in y
      stepX   = 0;
      tMaxX   = Number.MAX_VALUE;
      tDeltaX = 0;
    }

    if (dy < 0) {
      stepY   = -1;
      tMaxY   = (((y0)*TILE_WIDTH) - this.pos.y) / dy;
      tDeltaY = TILE_WIDTH / -dy;
    } else if (0 < dy) {
      stepY   = 1;
      tMaxY   = (((y0+1)*TILE_WIDTH) - this.pos.y) / dy;
      tDeltaY = TILE_WIDTH / dy;
    } else {
      // dy is 0, we should only walk in x
      stepY   = 0;
      tMaxY   = Number.MAX_VALUE;
      tDeltaY = 0;
    }

    while (node) {

      if (node === other.currentNode) {
        return true;
      }

      if (node && node.collidable) {
        return false;
      }

      if (tMaxX < tMaxY) {
        if (stepX < 0) {
          // we crossed the west edge; get new edge and neighbor
          node = node.west;
        } else {
          // we crossed the east edge; get new edge and neighbor
          node = node.east;
        }

        // traverse the grid
        tMaxX += tDeltaX;
        X     += stepX;

      } else {
        if (stepY < 0) {
          // we crossed the north edge; get new edge and neighbor
          node = node.north;
        } else {
          // we crossed the south edge; get new edge and neighbor
          node = node.south;
        }

        // traverse the grid
        tMaxY += tDeltaY;
        Y     += stepY;
      }
    }

    return false;
  };

  // take a relative Vector and make it a world Vector
  Sprite.prototype.relativeToWorld = function (relative) {
    Matrix.configure(this.pos.rot, 1.0, 0, 0);
    return Matrix.vectorMultiply(relative);
  };
  // take a world Vector and make it a relative Vector
  Sprite.prototype.worldToRelative = function (world) {
    Matrix.configure(-this.pos.rot, 1.0, 0, 0);
    return Matrix.vectorMultiply(world);
  };

  spriteMarshal(Sprite);

  return Sprite;
});
