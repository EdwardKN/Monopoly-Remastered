var canvas = document.createElement("canvas");
var c = canvas.getContext("2d");

var renderCanvas = document.createElement("canvas");
var renderC = renderCanvas.getContext("2d");
document.body.appendChild(renderCanvas);
renderCanvas.style.zIndex = 0

var scale = 0;

const renderScale = 2;

window.onload = fixCanvas;

window.addEventListener("resize", fixCanvas);

//document.addEventListener('contextmenu', event => event.preventDefault());

renderCanvas.addEventListener("mousemove", function (e) {
    let oldDown = mouse.down;
    let oldWhich = mouse.which;
    let oldUp = mouse.up;
    mouse = {
        x: e.offsetX / scale,
        y: e.offsetY / scale,
        down: oldDown,
        which: oldWhich,
        up: oldUp
    };
});

var mouse = {
    x: undefined,
    y: undefined,
    down: false
};

renderCanvas.addEventListener("mousedown", function (e) {
    mouse.down = true;
    mouse.up = false;
    mouse.which = e.which;
});
renderCanvas.addEventListener("mouseup", function (e) {
    mouse.down = false;
    mouse.up = true;
});

function fixCanvas() {
    canvas.width = 1920 / renderScale;
    canvas.height = 1080 / renderScale;
    if (window.innerWidth * 9 > window.innerHeight * 16) {
        renderCanvas.width = window.innerHeight * 16 / 9;
        renderCanvas.height = window.innerHeight;
        scale = renderCanvas.width / canvas.width;
    } else {
        renderCanvas.width = window.innerWidth;
        renderCanvas.height = window.innerWidth * 9 / 16;
        scale = renderCanvas.height / canvas.height;
    };
};

var buttons = [];
var textInputs = [];

class Slider {
    constructor(settings, onChange) {
        this.x = settings?.x;
        this.y = settings?.y;
        this.w = settings?.w;
        this.h = settings?.h;
        this.from = settings?.from;
        this.to = settings?.to;
        this.steps = (settings?.steps == undefined) ? 1 : settings?.steps;
        this.textSize = (settings?.textSize == undefined) ? this.h : settings?.textSize;
        this.unit = (settings?.unit == undefined) ? "" : settings?.unit;
        this.beginningText = (settings?.beginningText == undefined) ? "" : settings?.beginningText;
        this.onChange = (onChange == undefined ? function () { } : onChange);

        this.undefinedTextSize = (settings?.textSize == undefined);

        this.percentage = 0;
        this.value = 0;
        this.last = this.value;
        this.follow = false;
        buttons.push(this)

        if (this.undefinedTextSize) {
            this.textSize = c.getFontSize(this.beginningText + this.value + this.unit, this.w - 12, this.h - 4)
        }
    }
    update() {
        if (this.value !== this.last) {
            this.last = this.value;
            this.onChange();
            if (this.undefinedTextSize) {
                this.textSize = c.getFontSize(this.beginningText + this.value + this.unit, this.w - 12, this.h - 4)
            }
        };
        this.hover = detectCollision(this.x, this.y, this.w, this.h, mouse.x, mouse.y, 1, 1);
        if (mouse.down && this.hover) {
            mouse.down = false;
            this.follow = true;
        };
        if (mouse.up) {
            this.follow = false;
        };

        if (this.follow) {
            this.percentage = Math.max(Math.min((mouse.x - 2 - (this.x)) / (this.w - 4), 1), 0);
            this.value = Math.round((((this.to - this.from) * this.percentage) + this.from) / this.steps) * this.steps;
            if (this.value > this.to) {
                this.value = this.to;
            };

        };
        this.draw();


    }
    draw() {
        c.fillStyle = "white";
        c.fillRect(this.x, this.y, this.w, this.h);
        c.strokeStyle = "black";
        c.lineWidth = 4;
        c.strokeRect(this.x, this.y, this.w, this.h);

        c.fillStyle = "black";
        c.fillRect(this.x + (this.percentage) * (this.w - 4), this.y, 4, this.h);



        c.drawText(this.beginningText + this.value + this.unit, this.x + this.w / 2, this.y + this.h - (this.h - this.textSize) / 2 - 2, this.textSize, "center")
    }
}
class TextInput {
    constructor(settings, onChange) {
        this.x = settings?.x;
        this.y = settings?.y;
        this.w = settings?.w;
        this.h = settings?.h;
        this.textSize = (settings?.textSize == undefined) ? this.h : settings?.textSize;
        this.onChange = (onChange == undefined ? function () { } : onChange);

        this.maxLength = settings?.maxLength == undefined ? 100 : settings.maxLength;
        this.placeHolder = settings?.placeHolder;

        this.htmlElement = document.createElement("input");

        this.htmlElement.addEventListener("mousemove", e => {
            mouse.x = Infinity;
            mouse.y = Infinity;
        });

        document.body.appendChild(this.htmlElement);
        this.oldvalue = this.htmlElement.value;

        this.htmlElement.style.position = "absolute";

        this.htmlElement.style.padding = "0px";
        this.htmlElement.style.zIndex = 100;
        this.htmlElement.style.fontFamily = "Verdanai";
        this.htmlElement.placeholder = this.placeHolder != undefined ? this.placeHolder : "";

        textInputs.push(this);
    }
    draw() {
        this.htmlElement.style.display = "inline";
        this.htmlElement.style.left = this.x * scale + (window.innerWidth - renderCanvas.width) / 2 + "px";
        this.htmlElement.style.top = this.y * scale + (window.innerHeight - renderCanvas.height) / 2 + "px";
        this.htmlElement.style.width = this.w * scale - 10 * scale / 2 + "px";
        this.htmlElement.style.height = this.h * scale - 10 * scale / 2 + "px";

        this.htmlElement.style.fontSize = this.textSize * scale + "px";
        this.htmlElement.maxLength = this.maxLength;
        this.htmlElement.style.border = 5 * scale / 2 + "px solid black ";

        this.value = this.htmlElement.value;
    }
}

class Button {
    constructor(settings, image, onClick, onRightClick) {
        this.x = settings?.x;
        this.y = settings?.y;
        this.w = settings?.w;
        this.h = settings?.h;
        this.hover = false;
        this.invertedHover = false;
        this.onClick = onClick;
        this.onRightClick = onRightClick;
        this.image = image;
        this.invertedHitbox = settings?.invertedHitbox;
        this.disableHover = settings?.disableHover;
        this.disabled = false;
        this.mirrored = settings?.mirrored;
        this.hoverText = (settings?.hoverText == undefined ? "" : settings.hoverText)
        this.disableDisabledTexture = settings?.disableDisabledTexture;
        this.selectButton = settings?.selectButton;
        this.disableSelectTexture = settings?.disableSelectTexture;
        this.selected = false;
        this.text = settings?.text;
        this.textSize = settings?.textSize;
        this.color = settings?.color;

        if (!this.onRightClick) {
            this.onRightClick = function () { }
        }
        if (!this.onClick) {
            this.onClick = function () { }
        }

        buttons.push(this);
    }
    update() {
        this.hover = false;
        this.invertedHover = false;
        if (detectCollision(this.x, this.y, this.w, this.h, mouse.x, mouse.y, 1, 1)) {
            this.hover = true;
        }
        if (this.invertedHitbox != undefined && this.invertedHitbox != false && !detectCollision(this.invertedHitbox.x, this.invertedHitbox.y, this.invertedHitbox.w, this.invertedHitbox.h, mouse.x, mouse.y, 1, 1)) {
            this.invertedHover = true;
        }
        if ((this.hover || this.invertedHover) && mouse.down && !this.disabled) {
            mouse.down = false;
            this.selected = !this.selected;
            this.hover = false;
            this.onClick();
        }
        if (this.hover && mouse.rightDown && !this.disabled) {
            this.onRightClick();
        }

        this.draw()

    }
    draw() {
        let cropAdder = (this.hover && !this.disableHover) ? this.w : 0;
        cropAdder = (this.disabled) ? (this.disableDisabledTexture ? 0 : this.w * 2) : cropAdder;
        cropAdder += ((this.selectButton == undefined) ? 0 : (this.selected ? ((this.disableSelectTexture == undefined) ? this.w * 2 : this.w) : 0));
        c.drawRotatedImageFromSpriteSheet(this.image, {
            x: this.x,
            y: this.y,
            w: this.w,
            h: this.h,
            cropX: cropAdder,
            cropW: this.w,
            mirrored: this.mirrored
        })
        if (this.hover && !this.disabled) {
            hoverList.push(this.hoverText);
        }
        c.drawText(this.text, this.x + this.w / 2, this.y + this.textSize, this.textSize, "center", this.color)
    };
}


var spritesheet;
var spritesheetImage;
var images = {};

var f = new FontFace('verdanai', 'url(./verdanai.ttf)');
f.load().then(function (font) { document.fonts.add(font); });

var g = new FontFace('handwritten', 'url(./handwritten.ttf)');
g.load().then(function (font) { document.fonts.add(font); });

CanvasRenderingContext2D.prototype.getFontSize = function (text, maxWidth, maxHeight) {
    c.font = "10px verdanai"
    let width = c.measureText(text).width
    return (1 / width) * maxWidth * 10 > maxHeight ? maxHeight : (1 / width) * maxWidth * 10;
}

CanvasRenderingContext2D.prototype.drawText = function (text, x, y, fontSize, align, color, shadow) {
    this.font = fontSize + "px verdanai";
    this.fillStyle = "gray";
    this.shadowBlur = (shadow?.blur == undefined ? 0 : shadow?.blur);
    this.shadowColor = (shadow?.color == undefined ? "white" : shadow?.color);
    this.textAlign = (align != undefined) ? align : "left";
    this.fillText(text, x, y)
    this.shadowBlur = 0;
    this.fillStyle = (color !== undefined ? color : "black");
    this.fillText(text, x - 1, y - 1)
}


async function loadSpriteSheet() {
    var response = await fetch("./images/texture.json")
    spritesheet = await response.json();
    spritesheetImage = new Image();
    spritesheetImage.src = "./images/texture.png";
}

async function loadImages() {
    await loadSpriteSheet();
    spritesheet.frames.forEach((frame, i) => {
        let tmp = frame.filename.replaceAll(".png", "").split("/");
        images[tmp[0]] = images[tmp[0]] ?? {}
        images[tmp[0]][tmp[1]] = frame.frame;
    });
}

CanvasRenderingContext2D.prototype.drawImageFromSpriteSheet = function (frame, settingsOverride) {
    if (!frame) { return }
    let settings = {
        x: 0,
        y: 0,
        w: frame.w,
        h: frame.h,
        cropX: 0,
        cropY: 0,
        cropW: frame.w,
        cropH: frame.h
    };
    if (settingsOverride) {
        let tmp = Object.entries(settingsOverride);
        if (tmp.length) {
            tmp.forEach(setting => {
                settings[setting[0]] = setting[1];
            })
        }
    }

    this.drawImage(spritesheetImage, Math.floor(settings.cropX + frame.x), Math.floor(settings.cropY + frame.y), Math.floor(settings.cropW), Math.floor(settings.cropH), Math.floor(settings.x), Math.floor(settings.y), Math.floor(settings.w), Math.floor(settings.h));
}

CanvasRenderingContext2D.prototype.drawRotatedImageFromSpriteSheet = function (frame, settingsOverride) {
    if (!frame) { return }
    let settings = {
        x: 0,
        y: 0,
        w: frame.w,
        h: frame.h,
        rotation: 0,
        mirrored: false,
        cropX: 0,
        cropY: 0,
        cropW: frame.w,
        cropH: frame.h
    };
    if (settingsOverride) {
        let tmp = Object.entries(settingsOverride);
        if (tmp.length) {
            tmp.forEach(setting => {
                settings[setting[0]] = setting[1];
            })
        }
    }

    let degree = settings.rotation * Math.PI / 180;

    let middlePoint = {
        x: Math.floor(settings.x + settings.w / 2),
        y: Math.floor(settings.y + settings.h / 2)
    };

    this.save();
    this.translate(middlePoint.x, middlePoint.y);
    this.rotate(degree);
    if (settings.mirrored === true) {
        this.scale(-1, 1);
    }

    this.drawImageFromSpriteSheet(frame, { x: -settings.w / 2, y: -settings.h / 2, w: settings.w, h: settings.h, cropX: settings.cropX, cropY: settings.cropY, cropW: settings.cropW, cropH: settings.cropH });

    this.restore();
}

CanvasRenderingContext2D.prototype.drawIsometricImage = function (frame, settingsOverride) {
    if (!frame) { return }
    let settings = {
        x: 0,
        y: 0,
        w: frame.w,
        h: frame.h,
        rotation: 0,
        mirrored: false,
        cropX: 0,
        cropY: 0,
        cropW: frame.w,
        cropH: frame.h,
        offsetX: 0,
        offsetY: 0
    };
    if (settingsOverride) {
        let tmp = Object.entries(settingsOverride);
        if (tmp.length) {
            tmp.forEach(setting => {
                settings[setting[0]] = setting[1];
            })
        }
    }
    this.drawRotatedImageFromSpriteSheet(frame, { x: to_screen_coordinate(settings.x, settings.y).x + settings.offsetX, y: to_screen_coordinate(settings.x, settings.y).y + settings.offsetY, w: settings.w, h: settings.h, rotation: settings.rotation, mirrored: settings.mirrored, cropX: settings.cropX, cropY: settings.cropY, cropW: settings.cropW, cropH: settings.cropH })
}


const toRad = Math.PI / 180
const toDeg = 180 * Math.PI

function drawCircle(x, y, r, co) {
    c.beginPath();
    c.arc(x, y, r, 0, 2 * Math.PI, false);
    c.fillStyle = co;
    c.fill();
}

function detectCollision(x, y, w, h, x2, y2, w2, h2) {
    let convertedR1 = rectangleConverter(x, y, w, h);
    let convertedR2 = rectangleConverter(x2, y2, w2, h2);

    x = convertedR1[0];
    y = convertedR1[1];
    w = convertedR1[2];
    h = convertedR1[3];
    x2 = convertedR2[0];
    y2 = convertedR2[1];
    w2 = convertedR2[2];
    h2 = convertedR2[3];
    if (x + w > x2 && x < x2 + w2 && y + h > y2 && y < y2 + h2) {
        return true;
    };
};

function rectangleConverter(x, y, w, h) {
    if (w < 0) {
        x += w;
        w = Math.abs(w)
    }
    if (h < 0) {
        y += h;
        h = Math.abs(h)
    }
    return [x, y, w, h]
}
function distance(x1, y1, x2, y2) {
    const xDist = x2 - x1;
    const yDist = y2 - y1;

    return Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));
};

function drawLine(from, to, co) {
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.strokeStyle = co == undefined ? "black" : co;
    c.stroke();
}


function pointCircleCollide(point, circle, r) {
    if (r === 0) return false
    var dx = circle[0] - point[0]
    var dy = circle[1] - point[1]
    return dx * dx + dy * dy <= r * r
}

var tmp = [0, 0]

function lineCircleCollide(a, b, circle, radius, nearest) {
    //check to see if start or end points lie within circle
    if (pointCircleCollide(a, circle, radius)) {
        if (nearest) {
            nearest[0] = a[0]
            nearest[1] = a[1]
        }
        return true
    } if (pointCircleCollide(b, circle, radius)) {
        if (nearest) {
            nearest[0] = b[0]
            nearest[1] = b[1]
        }
        return true
    }

    var x1 = a[0],
        y1 = a[1],
        x2 = b[0],
        y2 = b[1],
        cx = circle[0],
        cy = circle[1]

    //vector d
    var dx = x2 - x1
    var dy = y2 - y1

    //vector lc
    var lcx = cx - x1
    var lcy = cy - y1

    //project lc onto d, resulting in vector p
    var dLen2 = dx * dx + dy * dy //len2 of d
    var px = dx
    var py = dy
    if (dLen2 > 0) {
        var dp = (lcx * dx + lcy * dy) / dLen2
        px *= dp
        py *= dp
    }

    if (!nearest)
        nearest = tmp
    nearest[0] = x1 + px
    nearest[1] = y1 + py

    //len2 of p
    var pLen2 = px * px + py * py

    //check collision
    return pointCircleCollide(nearest, circle, radius)
        && pLen2 <= dLen2 && (px * dx + py * dy) >= 0
}

function checkLineIntersection(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
    // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
    var denominator, a, b, numerator1, numerator2, result = {
        x: null,
        y: null,
        onLine1: false,
        onLine2: false
    };
    denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
    if (denominator == 0) {
        return result;
    }
    a = line1StartY - line2StartY;
    b = line1StartX - line2StartX;
    numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
    numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
    a = numerator1 / denominator;
    b = numerator2 / denominator;

    // if we cast these lines infinitely in both directions, they intersect here:
    result.x = line1StartX + (a * (line1EndX - line1StartX));
    result.y = line1StartY + (a * (line1EndY - line1StartY));
    /*
            // it is worth noting that this should be the same as:
            x = line2StartX + (b * (line2EndX - line2StartX));
            y = line2StartX + (b * (line2EndY - line2StartY));
            */
    // if line1 is a segment and line2 is infinite, they intersect if:
    if (a > 0 && a < 1) {
        result.onLine1 = true;
    }
    // if line2 is a segment and line1 is infinite, they intersect if:
    if (b > 0 && b < 1) {
        result.onLine2 = true;
    }
    // if line1 and line2 are segments, they intersect if both of the above are true
    return result;
};

function lineIntersect(a, b, c, d, p, q, r, s) {
    var det, gamma, lambda;
    det = (c - a) * (s - q) - (r - p) * (d - b);
    if (det === 0) {
        return false;
    } else {
        lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
        gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
        return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    }
};

function rectangleToLineIntersect(from, to, x, y, w, h) {
    let collisionArray = [];
    if (lineIntersect(from.x, from.y, to.x, to.y, x, y, x + w, y)) {
        collisionArray.push("up")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, x, y, x, y + h)) {
        collisionArray.push("left")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, x + w, y, x + w, y + h)) {
        collisionArray.push("right")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, x, y + h, x + w, y + h)) {
        collisionArray.push("down")
    }
    if (from.x == to.x) {
        if (detectCollision(from.x, from.y, 2, to.y - from.y, x + 2, y, 1, h)) {
            collisionArray.push("left")
        }
        if (detectCollision(from.x, from.y, 2, to.y - from.y, x + w, y, 1, h)) {
            collisionArray.push("right")
        }
    }
    if (from.y == to.y) {
        if (detectCollision(from.x, from.y, to.x - from.x, 2, x, y, w, 1)) {
            collisionArray.push("up")
        }
        if (detectCollision(from.x, from.y, to.x - from.x, 2, x, y + h, w, 1)) {
            collisionArray.push("down")
        }
    }
    return collisionArray;
}

function movingObjectToLineIntersect(from, to, x, y, w, h, oldX, oldY) {
    let collisionArray = [];
    if (lineIntersect(from.x, from.y, to.x, to.y, oldX, oldY, x + w, y)) {
        collisionArray.push("up")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, oldX, oldY, x, y + h)) {
        collisionArray.push("left")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, oldX + w, oldY, x + w, y + h)) {
        collisionArray.push("right")
    }
    if (lineIntersect(from.x, from.y, to.x, to.y, oldX, oldY + h, x + w, y + h)) {
        collisionArray.push("down")
    }
    if (from.x == to.x) {
        if (detectCollision(from.x, from.y, 2, to.y - from.y, x + 2, y, 1, h)) {
            collisionArray.push("left")
        }
        if (detectCollision(from.x, from.y, 2, to.y - from.y, x + w, y, 1, h)) {
            collisionArray.push("right")
        }
    }
    if (from.y == to.y) {
        if (detectCollision(from.x, from.y, to.x - from.x, 2, x, y, w, 1)) {
            collisionArray.push("up")
        }
        if (detectCollision(from.x, from.y, to.x - from.x, 2, x, y + h, w, 1)) {
            collisionArray.push("down")
        }
    }
    return collisionArray;
}

var pressedKeys = [];

window.addEventListener('keydown', function (e) {
    pressedKeys[e.code] = true;
})

window.addEventListener('keyup', function (e) {
    pressedKeys[e.code] = false;
})

Number.prototype.clamp = function (min, max) {
    if (this < min) return min;
    if (this > max) return max;
    return this;
};

function angleFromPoints(x, y, x2, y2) {
    return Math.atan2(y2 - y, x2 - x) * 180 / Math.PI
}
function angle(cx, cy, ex, ey) {
    var dy = ey - cy;
    var dx = ex - cx;
    var theta = Math.atan2(dy, dx); // range (-PI, PI]
    theta *= 180 / Math.PI; // rads to degs, range (-180, 180]
    return theta;
}
function angle360(cx, cy, ex, ey) {
    var theta = angle(cx, cy, ex, ey); // range (-180, 180]
    if (theta < 0) theta = 360 + theta; // range [0, 360)
    return theta;
}
function sum(a) {
    return a.reduce((partialSum, a) => partialSum + a);
}

function degToRad(a) {
    return Math.PI / 180 * a;
}
function meanAngleDeg(a) {
    let tmp = 180 / Math.PI * Math.atan2(
        sum(a.map(degToRad).map(Math.sin)) / a.length,
        sum(a.map(degToRad).map(Math.cos)) / a.length
    );
    if (tmp < 0) tmp = 360 + tmp; // range [0, 360)
    return tmp;
}

function getGroupedBy(arr, key) {
    var groups = {}, result = [];
    arr.forEach(function (a) {
        if (!(a[key] in groups)) {
            groups[a[key]] = [];
            result.push(groups[a[key]]);
        }
        groups[a[key]].push(a);
    });
    return result;
}

function randomIntFromRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
};

function to_screen_coordinate(x, y) {
    return {
        x: x * 0.5 + y * -0.5,
        y: x * 0.25 + y * 0.25
    }
}

function invert_matrix(a, b, c, d) {
    const det = (1 / (a * d - b * c));

    return {
        a: det * d,
        b: det * -b,
        c: det * -c,
        d: det * a,
    }
}

function to_grid_coordinate(x, y) {
    const a = 1 * 0.5;
    const b = -1 * 0.5;
    const c = 0.5 * 0.5;
    const d = 0.5 * 0.5;

    const inv = invert_matrix(a, b, c, d);

    return {
        x: Math.floor(x * inv.a + y * inv.b),
        y: Math.floor(x * inv.c + y * inv.d),
    }
}

function splitPoints(ammount, totalW, w, i) {
    return (totalW / ammount - w) / 2 + totalW / ammount * i
}


var times = [];
var fps = 60;
var deltaTime = 0;
var updateDelta = false;

function refreshLoop() {
    window.requestAnimationFrame(function () {
        const now = performance.now();
        while (times.length > 0 && times[0] <= now - 1000) {
            times.shift();
        }
        times.push(now);
        fps = times.length;
        deltaTime = updateDelta ? 60 / fps : 1;
        refreshLoop();
    });
}
refreshLoop();

setTimeout(() => { updateDelta = true; }, 1000);

var findClosest = function (x, arr) {
    var indexArr = arr.map(function (k) { return Math.abs(k - x) })
    var min = Math.min.apply(Math, indexArr)
    return arr[indexArr.indexOf(min)]
}

function hasDuplicates(array) {
    return (new Set(array)).size !== array.length;
}

Date.prototype.today = function () {
    return ((this.getDate() < 10) ? "0" : "") + this.getDate() + "/" + (((this.getMonth() + 1) < 10) ? "0" : "") + (this.getMonth() + 1) + "/" + this.getFullYear();
}
Date.prototype.timeNow = function () {
    return ((this.getHours() < 10) ? "0" : "") + this.getHours() + ":" + ((this.getMinutes() < 10) ? "0" : "") + this.getMinutes() + ":" + ((this.getSeconds() < 10) ? "0" : "") + this.getSeconds();
}

function getClassContructorParams(obj) {
    let match = obj.toString().match(/constructor\((.+)\)/)

    if (match && match[1]) {
        return match[1].split(",");
    }

    // If no match
    return []
}

function applyToConstructor(constructor, argArray) {
    var args = [null].concat(argArray);
    var factoryFunction = constructor.bind.apply(constructor, args);
    return new factoryFunction();
}

function monthToText(month) {
    return ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"][month]
};

function numberToText(number) {
    let siffror = ["EN", "ETT", "TVÅ", "TRE", "FYRA", "FEM", "SEX", "SJU", "ÅTTA", "NIO", "TIO", "ELVA", "TOLV", "TRETTON", "FJORTON", "FEMTON", "SEXTON", "SJUTTON", "ARTON", "NITTON", "TJUGO", "TRETTIO", "FYRTIO", "FEMTIO", "SEXTIO", "SJUTTIO", "ÅTTIO", "NITTIO", "HUNDRA", "TUSEN"]
    if (number < 21) {
        return siffror[number];
    } else if (number < 100) {
        if (number - Math.floor(number / 10) * 10 == 1) {
            if ((number - Math.floor(number / 10) * 10) !== 0) {
                return (siffror[Math.floor(number / 10) + 18] + siffror[number - Math.floor(number / 10) * 10 - 1])
            } else {
                return (siffror[Math.floor(number / 10) + 18])
            }
        } else {
            if (number - Math.floor(number / 10) * 10 == 0) {
                return (siffror[Math.floor(number / 10) + 18])
            } else {
                return (siffror[Math.floor(number / 10) + 18] + siffror[number - Math.floor(number / 10) * 10])
            }
        }
    } else if (number == 100) {
        return "ETT" + siffror[28]
    } else if (number < 1000 && JSON.parse(JSON.stringify(number).slice(1, 2)) < 2) {
        if (JSON.parse(JSON.stringify(number).slice(1, 2)) !== 0) {
            return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[28] + siffror[JSON.parse(JSON.stringify(number).slice(1, 3))]
        } else if (JSON.parse(JSON.stringify(number).slice(2, 3)) === 0) {
            return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[28]
        } else if (JSON.parse(JSON.stringify(number).slice(2, 3)) === 1) {
            return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[28] + siffror[0]
        } else {
            return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[28] + siffror[JSON.parse(JSON.stringify(number).slice(2, 3))]
        }
    } else if (number < 1000) {
        if (JSON.parse(JSON.stringify(number).slice(2, 3)) == 0) {
            return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[28] + siffror[JSON.parse(JSON.stringify(number).slice(1, 2)) + 18]
        } else {
            return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[28] + siffror[JSON.parse(JSON.stringify(number).slice(1, 2)) + 18] + siffror[JSON.parse(JSON.stringify(number).slice(2, 3))]
        }
    } else if (number == 1000) {
        return "ET" + siffror[29];
    } else if (number < 10000) {
        if (JSON.parse(JSON.stringify(number).slice(1, 2)) == 0) {
            if (JSON.parse(JSON.stringify(number).slice(2, 3)) < 2 && JSON.parse(JSON.stringify(number).slice(2, 3) > 0)) {
                return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[29] + siffror[JSON.parse(JSON.stringify(number).slice(2, 4))]
            } else if (JSON.parse(JSON.stringify(number).slice(2, 3)) < 2 && JSON.parse(JSON.stringify(number).slice(3, 4)) == 0) {
                return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[29];
            } else if (JSON.parse(JSON.stringify(number).slice(2, 3)) < 2) {
                return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[29] + siffror[JSON.parse(JSON.stringify(number).slice(3, 4))]
            } else if (JSON.parse(JSON.stringify(number).slice(3, 4)) == 0) {
                return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[29] + siffror[JSON.parse(JSON.stringify(number).slice(2, 3)) + 18]
            } else {
                return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[29] + siffror[JSON.parse(JSON.stringify(number).slice(2, 3)) + 18] + siffror[JSON.parse(JSON.stringify(number).slice(3, 4))]
            }
        } else {
            if (number < 10000 && JSON.parse(JSON.stringify(number).slice(2, 3)) < 2) {
                if (JSON.parse(JSON.stringify(number).slice(2, 3)) == 0) {
                    return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[29] + siffror[JSON.parse(JSON.stringify(number).slice(1, 2))] + siffror[28] + siffror[JSON.parse(JSON.stringify(number).slice(3, 4))]
                } else {
                    return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[29] + siffror[JSON.parse(JSON.stringify(number).slice(1, 2))] + siffror[28] + siffror[JSON.parse(JSON.stringify(number).slice(2, 4))]
                }
            } else if (JSON.parse(JSON.stringify(number).slice(3, 4)) == 0) {
                return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[29] + siffror[JSON.parse(JSON.stringify(number).slice(1, 2))] + siffror[28] + siffror[JSON.parse(JSON.stringify(number).slice(2, 3)) + 18]
            } else {
                return siffror[JSON.parse(JSON.stringify(number).slice(0, 1))] + siffror[29] + siffror[JSON.parse(JSON.stringify(number).slice(1, 2))] + siffror[28] + siffror[JSON.parse(JSON.stringify(number).slice(2, 3)) + 18] + siffror[JSON.parse(JSON.stringify(number).slice(3, 4))]
            }
        }

    }
}

const divide = (num = 100, n = 4) => {
    const f = Math.floor(num / n);
    return [...Array(n)].map((_, i) => i - n + 1 ? f : num - i * f);
}
