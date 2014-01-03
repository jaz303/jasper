var sexp    = require('sexp'),
    fs      = require('fs');

var args = process.argv.slice(2);

function fail(msg) {
    process.stderr.write(msg + "\n");
    process.exit(1);
}

if (!args.length) {
    fail("expected: input file");
}

try {
    var source = fs.readFileSync(args[0], {encoding: 'utf8'});    
} catch (e) {
    fail("error reading file " + args[0]);
}

try {
    var ast = sexp(source);
} catch (e) {
    fail("parse error");
}

//
// env

function Env(parent) {
    this._env = {};
    this._parent = parent || null;
}

Env.prototype.find = function(k) {
    if (this._env.hasOwnProperty(k)) {
        return this;
    } else if (this._parent) {
        return this._parent.find(k);
    } else {
        throw new Error("symbol not found: " + k);
    }
}

Env.prototype.set = function(k, v) {
    this._env[k] = v;
}

Env.prototype.get = function(k) {
    return this._env[k];
}

//
// helpers

function string_p(v) {
    return typeof v === 'string';
}

function all(p, ary) {
    for (var i = 0; i < ary.length; ++i) {
        if (!p(ary[i])) return false;
    }
    return true;
}

//
//


function makeRootEnv() {

    var root = new Env();

    var slice = Array.prototype.slice;

    function reduce(cb, val, xs) {
        for (var i = 0; i < xs.length; ++i) {
            val = cb(val, xs[i]);
        }
        return val;
    }

    var env = root._env;

    env['+'] = function() {
        return reduce(function(l,r) { return l + r; }, 0, arguments);
    };

    env['-'] = function() {
        return reduce(function(l,r) { return l - r; }, 0, arguments);
    }

    env['*'] = function() {
        return reduce(function(l,r) { return l * r; }, 0, arguments);
    }

    env['/'] = function() {
        return reduce(function(l,r) { return l / r; }, 0, arguments);
    }

    env['car'] = function() { return arguments[0]; }
    env['cdr'] = function() { return slice.call(arguments[0], 1); }

    env['print'] = console.log.bind(console);

    return root;

}

function evaluate(env, code) {
    
    if (typeof code === 'string') {

        return env.find(code).get(code);
    
    } else if (!Array.isArray(code)) {

        return code;
    
    } else if (code[0] === 'quote') {
    
        return code[1];
    
    } else if (code[0] === 'define') {
    
        var k = code[1],
            v = evaluate(env, code[2]);
        
        env.set(k, v);

        return v;
    
    } else if (code[0] === 'set!') {
    
        var k = code[1],
            t = env.find(k),
            v = evaluate(env, code[2]);
        
        t.set(k, v);

        return v;
    
    } else if (code[0] === 'do') {
    
        var v = null;
        code.slice(1).forEach(function(exp) {
            v = evaluate(env, exp);
        });

        return v;
    
    } else if (code[0] === 'lambda') {

        var params, body;

        if (code.length === 2) {
            params = [];
            body = code[1];
        } else if (code.length === 3) {
            params = code[1],
            body = code[2];
        } else {
            throw new Error("lambda: argument error");
        }

        if (!Array.isArray(params) || !Array.isArray(body)) {
            throw new Error("lambda: argument error");   
        }

        if (!all(string_p, params)) {
            throw new Error("lambda: params must be list of strings");
        }

        return function() {

            if (arguments.length !== params.length) {
                throw new Error("argument error: " + arguments.length + " for " + params.length);
            }

            var localEnv = new Env(env);

            for (var i = 0; i < params.length; ++i) {
                localEnv.set(params[i], arguments[i]);
            }

            return evaluate(localEnv, body);

        }

    } else {

        var exps = code.map(function(exp) {
            return evaluate(env, exp);
        });

        var fn = exps.shift();

        return fn.apply(null, exps);

    }

}

evaluate(makeRootEnv(), ast);