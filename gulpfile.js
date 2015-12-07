// TODO: require on demand??
var fs       = require('fs'),
    gulp     = require('gulp'),
    glob     = require('glob'),
    zlib     = require('zlib'),
    path     = require('path'),
    args     = require('yargs').argv,
    util     = require('gulp-util'),
    mkdirp   = require('mkdirp'),
    merge    = require('merge-stream'),
    concat   = require('gulp-concat-util'),
    replace  = require('gulp-replace'),
    through  = require('through2'),
    reload   = require('require-reload')(require),
    compiler = require('closure-compiler-stream');

var COMPIER_JAR_PATH = 'bower_components/closure-compiler/compiler.jar';
var PRECOMPILED_MIN_DIR = 'release/precompiled/minified/';
var PRECOMPILED_DEV_DIR = 'release/precompiled/development/';

var HELP_MESSAGE = [
  '',
  '    %Usage%',
  '',
  '      gulp [TASK] [OPTIONS]',
  '',
  '    %Tasks%',
  '',
  '      |dev|                          Non-minified build (concatenate files only).',
  '      |min|                          Minified build.',
  '      |help|                         Show this message.',
  '',
  '    %Options%',
  '',
  '      -p, --packages PACKAGES      Comma separated packages to include (optional). Packages below (non-default marked with |*|).',
  '      -v, --version VERSION        Version (optional).',
  '',
  '    %Packages%',
  '',
  '      es6',
  '      array',
  '      date',
  '      function',
  '      number',
  '      object',
  '      range',
  '      regexp',
  '      string',
  '      es5 |*|',
  '      locales |*|',
  '      language |*|',
  '      inflections |*|',
  '',
  '    %Notes%',
  '',
  '      ES5 package is no longer default in Sugar builds. It should be',
  '      added if ES5 compatibility is required in environments where it',
  '      does not exist (most commonly IE8 and below).',
  '',
  '      ES6 package is default and includes minimal ES6 polyfills required',
  '      by Sugar. This package can be removed if full ES6 support can be',
  '      guaranteed, either natively or through a polyfill library.',
  '',
].join('\n');

var COPYRIGHT = [
  '/*',
  ' *  Sugar Library VERSION',
  ' *',
  ' *  Freely distributable and licensed under the MIT-style license.',
  ' *  Copyright (c) YEAR Andrew Plummer',
  ' *  http://sugarjs.com/',
  ' *',
  ' * ---------------------------- */'
].join('\n');

var DEFAULT_PACKAGES = [
  'es6',
  'array',
  'date',
  'range',
  'function',
  'number',
  'object',
  'regexp',
  'string'
];

var ALL_PACKAGES = [
  'es6',
  'array',
  'date',
  'range',
  'function',
  'number',
  'object',
  'regexp',
  'string',
  'inflections',
  'language',
  'locales'
];

function getPackages() {
  return args.p || args.packages || 'default';
}

function getFiles(packages, skipLocales) {
  var arr, files = [];
  if (packages === 'core') {
    return ['lib/core.js'];
  }
  files.push('lib/core.js');
  files.push('lib/common.js');
  arr = packages.split(',');
  arr.forEach(function(name) {
    if (name === 'default') {
      Array.prototype.push.apply(arr, DEFAULT_PACKAGES);
    } else if (name === 'all') {
      Array.prototype.push.apply(arr, ALL_PACKAGES);
    }
  });
  arr.forEach(function(p) {
    if (p === 'locales' && !skipLocales) {
      files = files.concat(glob.sync('lib/locales/*.js'));
    } else {
      files.push('lib/' + p + '.js');
    }
  });
  return files;
}

function getModules(files) {
  var modules = [], locales = [];
  files.forEach(function(f) {
    var name = f.match(/(\w+)\.js/)[1];
    if (name === 'core') {
      modules.push(['core:1', f]);
    } else if (f.match(/locales/)) {
      locales.push(f);
    } else {
      modules.push([name + ':1:core', f]);
    }
  });
  if (locales.length) {
    modules.push(['locales:' + locales.length + ':core'].concat(locales));
  }
  return modules;
}

function showHelpMessage() {
  var msg = HELP_MESSAGE
    .replace(/%\w+%/g, function(match) {
      return util.colors.underline(match.replace(/%/g, ''));
    })
  .replace(/\|.+\|/g, function(match) {
    if(match === '|*|') {
      return util.colors.yellow(match.replace(/\|/g, ''));
    } else {
      return util.colors.cyan(match.replace(/\|/g, ''));
    }
  });
  console.info(msg);
}

function getFilename(name, min) {
  return name + (min ? '.min' : '') + '.js';
}

function getVersion() {
  return args.v || args.version || '';
}

function getLicense() {
  var version = getVersion();
  return COPYRIGHT
    .replace(/VERSION/, version.match(/[\d.]+/) ? 'v' + version : version)
    .replace(/YEAR/, new Date().getFullYear())
    .replace(/\n$/, '');
}

function buildDevelopment(packages, path) {
  var template = [
    getLicense(),
    '(function() {',
      "  'use strict';",
      '$1',
    '}).call(this);'
  ].join('\n');
  var files = getFiles(packages);
  var filename = getFilename(path || 'sugar');
  util.log(util.colors.yellow('Building:', filename));
  return gulp.src(files)
    .pipe(concat(filename, { newLine: '' }))
    .pipe(replace(/^\s*'use strict';\n/g, ''))
    .pipe(replace(/^([\s\S]+)$/m, template))
    .pipe(gulp.dest('.'));
}

function buildMinified(packages, path) {
  try {
    fs.lstatSync(COMPIER_JAR_PATH);
  } catch(e) {
    util.log(util.colors.red('Closure compiler missing!'), 'Run', util.colors.yellow('bower install'));
    return;
  }
  var files = getFiles(packages);
  var filename = getFilename(path || 'sugar', true);
  util.log(util.colors.yellow('Minifying:', filename));
  return gulp.src(files).pipe(compileSingle(filename));
}

// -------------- Compiler ----------------

function compileModules(modules) {
  var flags = getDefaultFlags();
  flags.module = modules;
  flags.module_output_path_prefix = PRECOMPILED_MIN_DIR;
  return compiler(flags);
}

function compileSingle(path) {
  var flags = getDefaultFlags();
  flags.js_output_file = path;
  return compiler(flags);
}

function getDefaultFlags() {
  return {
    jar: COMPIER_JAR_PATH,
    compilation_level: 'ADVANCED_OPTIMIZATIONS',
    jscomp_off: ['globalThis', 'misplacedTypeAnnotation', 'checkTypes'],
    output_wrapper: getLicense() + "\n(function(){'use strict';%output%}).call(this);",
    externs: 'lib/extras/externs.js',
  }
}



// -------------- Build ----------------

gulp.task('default', showHelpMessage);

gulp.task('help', showHelpMessage);

gulp.task('dev', function() {
  return buildDevelopment(getPackages());
});

gulp.task('min', function(done) {
  return buildMinified(getPackages());
});

gulp.task('release', function() {
  util.log(util.colors.blue('-------------------------------'));
  util.log(util.colors.blue('Building release:', getVersion()));
  util.log(util.colors.blue('-------------------------------'));
  return merge(buildDevelopment('default'), buildMinified('default'));
});

gulp.task('precompile:dev', function() {
  var files = getFiles('all').filter(function(path) {
    return !path.match(/locales/);
  });
  return merge(gulp.src(files), gulp.src('lib/locales/*.js')
      .pipe(concat('locales.js', { newLine: '' })))
    .pipe(replace(/^\s*'use strict';\n/g, ''))
    .pipe(gulp.dest(PRECOMPILED_DEV_DIR));
});

gulp.task('precompile:min', function() {
  var files = getFiles('all');
  var modules = getModules(files);
  return gulp.src(files).pipe(compileModules(modules));
});


// -------------- npm ----------------

var NPM_MODULES = [
  {
    name: 'sugar-full',
    description: 'This build includes all Sugar packages including extra string helpers and all Date locales.',
    files: 'es6,all'
  },
  {
    name: 'sugar-core',
    description: 'This build is only the core module, which allows custom methods to be defined and extended later.',
    files: 'core'
  },
  {
    name: 'sugar-array',
    description: 'This build includes array manipulation and traversal, "fuzzy matching" against elements, alphanumeric sorting and collation, and enumerable methods on Object.',
    files: 'es6,array'
  },
  {
    name: 'sugar-date',
    description: 'This build includes date parsing and formatting, relative formats like "1 minute ago", number methods like "daysAgo", and localization support. This build includes English only. For other locales, see the sugar-date-locales module.',
    files: 'date'
  },
  {
    name: 'sugar-date-locales',
    description: 'This build includes date parsing and formatting, relative formats like "1 minute ago", number methods like "daysAgo", and localization support. This build includes all available locales.',
    files: 'date,locales'
  },
  {
    name: 'sugar-range',
    description: 'This build includes ranges which create spans of numbers, strings, or dates. They can enumerate over specific points within that range, and be manipulated and compared.',
    files: 'range'
  },
  {
    name: 'sugar-function',
    description: 'This build includes helpers for lazy, throttled, and memoized functions, delayed functions and handling of timers, and argument currying.',
    files: 'function'
  },
  {
    name: 'sugar-number',
    description: 'This build includes helpers for number formatting, rounding (with precision), and aliases to Math methods.',
    files: 'number'
  },
  {
    name: 'sugar-object',
    description: 'This build includes helpers for object manipulation, type checking (isNumber, isString, etc) and extended objects with hash-like methods. Note that Object.prototype is not extended by default. See the README for more.',
    files: 'object'
  },
  {
    name: 'sugar-regexp',
    description: 'This build includes helpers for escaping regexes and manipulating their flags.',
    files: 'regexp'
  },
  {
    name: 'sugar-string',
    description: 'This build includes helpers for string manupulation, escaping, encoding, truncation, and conversion.',
    files: 'es6,string'
  },
  {
    name: 'sugar-inflections',
    description: 'This build includes pluralization similar to ActiveSupport including uncountable words and acronyms, humanized and URL-friendly strings.',
    files: 'string,inflections'
  },
  {
    name: 'sugar-language',
    description: 'This build includes helpers for detecting language by character block, full-width <-> half-width character conversion, and Hiragana and Katakana conversions.',
    files: 'language'
  }
];

function getKeywords(name, keywords) {
  if (!name.match(/date|full/)) {
    keywords = keywords.filter(function(k) {
      return k !== 'date' && k !== 'time';
    });
  }
  return keywords;
}

function getModulePackage(module, mainPackage) {
  var package = JSON.parse(JSON.stringify(mainPackage));
  package.name = module.name;
  package.main = module.name + '.js';
  package.keywords = getKeywords(module.name, package.keywords);
  package.description += ' ' + module.description;
  delete package.files;
  delete package.scripts;
  delete package.devDependencies;
  return JSON.stringify(package, null, 2);
}

function getModuleBower(module, mainBower) {
  var bower = JSON.parse(JSON.stringify(mainBower));
  bower.name = module.name;
  bower.main = module.name + '.min.js';
  // Bower throws a warning if "ignore" isn't defined.
  bower.ignore = [];
  bower.keywords = getKeywords(module.name, bower.keywords);
  bower.description += ' ' + module.description;
  delete bower.devDependencies;
  return JSON.stringify(bower, null, 2);
}

gulp.task('npm', function() {
  var streams = [];
  var mainPackage = require('./package.json');
  var mainBower = require('./bower.json');
  for (var i = 0; i < NPM_MODULES.length; i++) {
    var module = NPM_MODULES[i];
    var path = 'release/npm/' + module.name + '/';
    mkdirp.sync(path);
    fs.writeFileSync(path + 'package.json', getModulePackage(module, mainPackage));
    fs.writeFileSync(path + 'bower.json', getModuleBower(module, mainBower));
    streams.push(buildDevelopment(module.files, path + module.name));
    streams.push(gulp.src(['LICENSE', 'README.md', 'CHANGELOG.md']).pipe(gulp.dest(path)));
  }
  return merge(streams);
});

gulp.task('npm:min', function() {
  var streams = [];
  for (var i = 0; i < NPM_MODULES.length; i++) {
    var module = NPM_MODULES[i];
    var path = 'release/npm/' + module.name + '/';
    mkdirp.sync(path);
    streams.push(buildMinified(module.files, path + module.name));
  }
  return merge(streams);
});


// -------------- Modularize ----------------


//  Rules:
//
//  1. This task will walk through the top level of the source code,
//     separating packages for Sugar internals and method definitions,
//     and creating a flat dependency tree. The top level may consist
//     only of variable declarations and assignments, functions for
//     internal use, Sugar method declarations with "defineInstance",
//     etc, and "build" methods (more below). Variables in all caps
//     will be considered "constants", otherwise "vars".
//
//  2. Any variable dependency built up programmatically must have
//     an associated "build" method (begins with "build") that is
//     top level. The built up variable must be assigned inside the
//     build method.
//
//  3. Build methods may build multiple variables, but they must all
//     be unassigned until inside the build method.
//
//  4. Build methods may define Sugar methods. These must use the normal
//     "define" methods. If they use "defineInstanceSimilar", then the
//     method names must either be a literal, comma separated string, or
//     exist in the comment block immediately preceeding the build method,
//     found either by @method or (more commonly) @set.
//
//  5. Build methods may not call defined Sugar methods. Refactor to use
//     a top level internal method instead.
//
//  6. All Sugar methods found will be added to a "module" file that
//     loads them all.
//
//  7. (TODO) Comments that appear no more than 2 lines before a top level
//     dependency will be added to the exported package.

function modularize() {

  var TAB = '  ';
  var NPM_DESTINATION = 'release/npm/sugar';
  var WHITELISTED = ['arguments', 'undefined', 'NaN', 'btoa', 'atob'];
  var BLOCK_DELIMITER = '\n\n';

  var DECLARES_PREAMBLE = [
    '// Exported function declaration was hoisted here',
    '// to avoid problems with circular dependencies.'
  ].join('\n');

  var acorn = require('acorn');

  var topLevel = {};
  var sugarMethods = {};

  function iter(obj, fn) {
    for (var key in obj) {
      if(!obj.hasOwnProperty(key)) continue;
      fn(key, obj[key]);
    };
  }

  function downcase(str) {
    return str.slice(0, 1).toLowerCase() + str.slice(1);
  }

  function getDependencies(name, n) {
    var deps = [], locals = [];

    function log() {
      if (name === 'xxx') {
        console.log.apply(null, [name + ':'].concat(Array.prototype.slice.call(arguments, 0)));
      }
    }

    function pushLocal(loc) {
      if (locals.indexOf(loc) === -1) {
        log("PUSHING LOCAL", loc);
        locals.push(loc);
      }
    }

    function pushLocals(nodes) {
      nodes.forEach(function(id) {
        pushLocal(id.name);
      });
    }

    function pushDependency(dep) {
      if (deps.indexOf(dep) === -1) {
        log("PUSHING DEPENDENCY", dep);
        deps.push(dep);
      }
    }

    function walk(n) {
      if (!n) {
        return;
      }
      if (n.type) n = [n];
      n.forEach(processNode);
    }

    function processNode(node) {
      log('PROCESSING:', node.type);
      switch(node.type) {
        case 'Identifier':
          pushDependency(node.name);
          return;
        case 'VariableDeclarator':
          pushLocal(node.id.name);
          walk(node.init);
          return;
        case 'FunctionDeclaration':
          pushLocal(node.id.name);
          pushLocals(node.params);
          walk(node.body);
          return;
        case 'FunctionExpression':
          pushLocals(node.params);
          walk(node.body.body);
          return;
        case 'CatchClause':
          pushLocal(node.param);
          walk(node.body);
          return;
        case 'MemberExpression':
          walk(node.object);
          // If the MemberExpression is computed syntax (a[b]) then
          // the property value may be a depencency, so step in.
          if (node.computed) walk(node.property);
          return;
        case 'ExpressionStatement':
          walk(node.expression);
          return;
        case 'SequenceExpression':
          walk(node.expressions);
          return;
        case 'SwitchStatement':
          walk(node.discriminant);
          walk(node.cases);
          return;
        case 'ObjectExpression':
          walk(node.properties);
          return;
        case 'ArrayExpression':
          walk(node.elements);
          return;
        case 'TryStatement':
          walk(node.block);
          walk(node.handler);
          walk(node.finalizer);
          return;
        case 'BlockStatement':
          walk(node.body);
          return;
        case 'ForStatement':
          walk(node.init);
          walk(node.test);
          walk(node.update);
          walk(node.body);
          return;
        case 'ForInStatement':
          walk(node.left);
          walk(node.right);
          walk(node.body);
          return;
        case 'WhileStatement':
          walk(node.test);
          walk(node.body);
          return;
        case 'DoWhileStatement':
          walk(node.body);
          walk(node.test);
          return;
        case 'VariableDeclaration':
          walk(node.declarations);
          return;
        case 'Property':
          walk(node.value);
          return;
        case 'NewExpression':
        case 'CallExpression':
          walk(node.callee);
          walk(node.arguments);
          return;
        case 'SwitchCase':
        case 'IfStatement':
        case 'ConditionalExpression':
          walk(node.test);
          walk(node.consequent);
          walk(node.alternate);
          return;
        case 'BinaryExpression':
        case 'LogicalExpression':
        case 'AssignmentExpression':
          walk(node.left);
          walk(node.right);
          return;
        case 'ThrowStatement':
        case 'ReturnStatement':
        case 'UnaryExpression':
        case 'UpdateExpression':
          walk(node.argument);
          return;
        case 'Literal':
        case 'EmptyStatement':
        case 'ThisExpression':
        case 'BreakStatement':
        case 'ContinueStatement':
          // Pass on literals, {}, this, break, continue
          return;
        default:
          console.info(node);
          throw new Error("Unknown Node: " + node.type);
      }
    }

    function isValidDependency(d) {
      return locals.indexOf(d) === -1 && !global[d] && WHITELISTED.indexOf(d) === -1;
    }

    walk(n);
    return deps.filter(isValidDependency);
  }

  function parseModule(module, hasModuleBundle) {
    var commentsByEndLine = {}, counter = 1, namespaceRanges = [], currentNamespaceRange, source, filePath;

    function onComment(block, text, start, stop, startLoc, endLoc) {
      var matches;
      commentsByEndLine[endLoc.line] = {
        text: text,
        block: block
      }
      // Both @package and @namespace may be defined in the same comment block.
      matches = text.match(/@(namespace|package) \w+/g);
      if (matches) {
        var namespace = matches[matches.length - 1].match(/@(namespace|package) (\w+)/)[2];
        namespaceBoundary(namespace, endLoc.line);
      }
    }

    function namespaceBoundary(namespace, line) {
      if (currentNamespaceRange) {
        namespaceRanges.push(currentNamespaceRange);
      }
      if (namespace) {
        currentNamespaceRange = {
          name: namespace,
          line: line
        }
      }
    }

    function getNamespaceForNode(node) {
      var line = node.loc.start.line, namespace;
      namespaceRanges.forEach(function(r) {
        if (r.line < line) {
          namespace = r.name;
        }
      });
      return namespace;
    }

    function getFullMethodKey(node, name) {
      var namespace = getNamespaceForNode(node);
      return namespace + '|' + name;
    }

    function processTopLevelNode(node) {
      switch (true) {
        case isUseStrict(node):           return;
        case isVariableDeclaration(node): return addVars(node);
        case isFunctionDeclaration(node): return addInternal(node);
        case isMethodBlock(node):         return processMethodBlock(node);
        case isMemberAssignment(node):    return processTopLevelMemberAssignment(node);
        case isAliasExpression(node):     return processAliasExpression(node);
        case isBuildExpression(node):     return processBuildExpression(node);
        default:
          console.info(node);
          throw new Error("Unknown Top Level Node: " + node.type);
      }
    }

    function isUseStrict(node) {
      return node.type === 'ExpressionStatement' && node.expression.value === 'use strict';
    }

    function isVariableDeclaration(node) {
      return node.type === 'VariableDeclaration';
    }

    function isFunctionDeclaration(node) {
      return node.type === 'FunctionDeclaration';
    }

    function isMethodBlock(node) {
      return node.type === 'ExpressionStatement' &&
             node.expression.type === 'CallExpression' &&
             node.expression.callee.name &&
             !!node.expression.callee.name.match(/^define(Static|Instance(AndStatic)?)(WithArguments)?$/);
    }

    function isSimilarMethodBlock(node) {
      return node.type === 'ExpressionStatement' &&
             node.expression.type === 'CallExpression' &&
             node.expression.callee.name &&
             !!node.expression.callee.name.match(/^define(Static|Instance(AndStatic)?)Similar$/);
    }

    function isMemberAssignment(node) {
      return node.type === 'ExpressionStatement' &&
             node.expression.type === 'AssignmentExpression' &&
             node.expression.left.type === 'MemberExpression';
    }

    function isBuildExpression(node) {
      return node.type === 'ExpressionStatement' &&
             node.expression.type === 'CallExpression' &&
             !!node.expression.callee.name.match(/^build/);
    }

    function isAliasExpression(node) {
      return node.type === 'ExpressionStatement' &&
             node.expression.type === 'CallExpression' &&
             node.expression.callee.name === 'alias';
    }

    function getNodeBody(node) {
      // Subtract the column to offset the first line's whitespace as well.
      return source.slice(node.start - node.loc.start.column, node.end);
    }

    function getInnerNodeBody(node) {
      // Only get the exact node body, no leading whitespace.
      return source.slice(node.start, node.end);
    }

    function addTopLevel(name, node, type, exports) {
      var core = false, body;
      if (type === 'vars') {
        body = getInnerNodeBody(node).replace(/\s+=\s+/, ' = ');
        var match = body.match(/^[\w.]+ = ([\w.]+)$/);
        if (match) {
          // If the var is just a simple property assignment,
          // then just set it directly to the exports.
          exports = match[1];
          body = null;
        } else {
          body = 'var ' + getInnerNodeBody(node) + ';';
        }
      } else {
        body = getNodeBody(node);
      }
      if (exports === true) {
        exports = name;
      }
      var deps = getDependencies(name, node);
      var sugarIndex = deps.indexOf('Sugar');
      if (sugarIndex !== -1) {
        deps.splice(sugarIndex, 1);
        core = true;
      }
      var package = {
        node: node,
        name: name,
        type: type,
        core: core,
        path: path.join(module, type),
        body: body,
        module: module,
        exports: exports,
        dependencies: deps,
      };
      // "Top level" are all "globals", so no collisions
      // should occur by putting them in the same namespace.
      return topLevel[name] = package;
    }

    function addVars(node) {
      node.declarations.forEach(function(d) {
        var name = d.id.name;
        var type = /^[A-Z_]+$/.test(name) ? 'constants' : 'vars';
        addTopLevel(name, d, type, true);
      });
    }

    function addInternal(node) {
      addTopLevel(node.id.name, node, 'internal', true);
    }

    function addSugarMethod(name, node, opts) {
      var namespace = getNamespaceForNode(node), body, deps;

      if (opts.body) {
        // If the method has a body then get its dependencies. A method may be
        // empty if it is being built via a build expresssion or a "similar"
        // block and only needs to require that package to be defined.
        body = getNodeBody(node);
        deps = getDependencies(name, node);

        if (opts.define) {
          // defineInstance/defineStatic, etc.
          var init = ['Sugar', namespace, opts.define].join('.');
          body = [ init + '({', '', body, '', '});'].join('\n');
        }
      }

      sugarMethods[getFullMethodKey(node, name)] = {
        core: true,
        name: name,
        body: body,
        module: module,
        dependencies: deps,
        requires: opts.requires,
        path: namespace.toLowerCase(),
        exports: ['Sugar', namespace, name].join('.'),
      };
    }

    function getLastCommentForNode(node) {
      var line = node.loc.start.line, comment;
      while (!comment && line > 0) {
        comment = commentsByEndLine[--line];
      }
      return comment;
    }

    function getAllMethodNamesInPreviousComment(node) {
      var names = [];
      var comment = getLastCommentForNode(node);
      var blocks = comment.text.split('***');
      blocks.forEach(function(block) {
        var match = block.match(/@set([^@\/]+)/);
        if (match) {
          var set = match[1];
          set = set.replace(/^[\s*]*|[\s*]*$/g, '').replace(/[\s*]+/g, ',');
          names = names.concat(set.split(','));
        } else {
          match = block.match(/@method (\w+)/);
          if (match) {
            names.push(match[1]);
          }
        }
      });
      return names;
    }

    function getFallbackGroupName() {
      return 'group-' + counter++;
    }

    function appendBlock(package, field, body) {
      var existing = package[field];
      package[field] = existing ? existing + '\n' + body : body;
    }

    function processMethodBlock(node) {
      var defineName = node.expression.callee.name;
      var methods = node.expression.arguments[1].properties;
      methods.forEach(function(node) {
        addSugarMethod(node.key.value, node, {
          body: true,
          define: defineName
        });
      });
    }

    function processTopLevelMemberAssignment(node) {
      var propNode = node.expression.left, name;
      while (propNode.type === 'MemberExpression') {
        propNode = propNode.object;
      }
      name = propNode.name;
      var package = topLevel[name];
      var deps = getDependencies(name, node.expression.right).filter(function(d) {
        return d !== name;
      });
      package.dependencies = package.dependencies.concat(deps);
      appendBlock(package, 'body', getNodeBody(node));
    }

    function processBuildExpression(node) {
      var mainPackage, fnPackage, fnCall, unassignedVars, deps;

      // Build functions can be used in a few different ways. They can build
      // one or more variables for later use and can also define methods. The
      // general strategy here is to first check for method definitions and
      // add them, then check the number of undefined variables that require
      // the function (ie. dependencies of the function that have a simple
      // declare block but no assignment). If there is only one, then simply
      // add the build function body, build function dependencies, and build
      // function call itself to the variable package. If there is more than
      // one variable being built, then create a new package based on the build
      // function name, throw everything into it together, and alias all the
      // variable packages to it.

      fnCall = getNodeBody(node);
      fnPackage  = topLevel[node.expression.callee.name];

      unassignedVars = [];

      // Do an initial runthrough of the dependencies to
      // extract those that are unassigned into an array.
      deps = fnPackage.dependencies.filter(function(name) {
        var package = topLevel[name];
        if (package.node.type === 'VariableDeclarator' && !package.node.init) {
          unassignedVars.push(package);
          return false;
        }
        return true;
      });

      if (unassignedVars.length === 0) {

        // If there are no unassigned variables at all, then the build
        // function is simply defining methods, so add the initializing
        // call and set the final package to allow it to do this.

        mainPackage = fnPackage;
        appendBlock(fnPackage, 'init', fnCall);
        delete fnPackage.exports; // Nothing to export

      } else if (unassignedVars.length === 1) {

        // If there is only one unassigned variable then the build function
        // and its initializing call can simply be added into the variable
        // package. When a function requires that variable it will then be
        // built.

        var varPackage = unassignedVars[0];
        varPackage.body = [varPackage.body, fnPackage.body].join(BLOCK_DELIMITER);
        appendBlock(varPackage, 'init', fnCall);
        varPackage.dependencies = varPackage.dependencies.concat(deps);

        mainPackage = varPackage;

      } else if (unassignedVars.length > 1) {

        // If there are more than one unassigned variables then we need to
        // bundle them together and export multiple. Use the build function
        // name to create the grouped package and alias the variable packages
        // to point to it.

        var groupName = downcase(fnPackage.name.replace(/^build/, ''));

        var declares = [], exports = [];

        unassignedVars.forEach(function(v) {
          v.alias = groupName;
          exports.push(v.name);
          declares.push(v.body);
        });

        // The grouped package consists of any declared variables, the build
        // function definition, and the initializing call all rolled together.
        var body = [declares.join('\n'), fnPackage.body].join(BLOCK_DELIMITER);

        mainPackage = topLevel[groupName] = {
          name: groupName,
          body: body,
          init: fnCall,
          module: module,
          exports: exports,
          dependencies: deps,
          path: path.join(module, 'vars'),
        };

      }

      // The build function may define methods, so step
      // into it and create method packages if necessary.
      fnPackage.node.body.body.forEach(function(node) {
        if (isMethodBlock(node)) {
          var methods = node.expression.arguments[1].properties;
          methods.forEach(function(node) {
            addSugarMethod(node.key.value, node, {
              requires: [mainPackage.name]
            });
          });
        } else if (isSimilarMethodBlock(node)) {
          var argNode = node.expression.arguments[1], methodNames;
          if (argNode.type === 'Literal' && argNode.value) {
            // If the argument to defineInstanceSimilar is a literal string,
            // then we can pull the method names directly out of that.
            methodNames = argNode.value.split(',');
          } else {
            // Otherwise, assume the method names appear in the previous
            // comment block and get them from there.
            methodNames = getAllMethodNamesInPreviousComment(node);
          }
          methodNames.forEach(function(name) {
            addSugarMethod(name, node, {
              requires: [mainPackage.name]
            });
          });
        } else if (isAliasExpression(node)) {
          var name = node.expression.arguments[1].value;
          var sourceName = node.expression.arguments[2].value;
          addSugarMethod(name, node, {
            requires: [getFullMethodKey(node, sourceName), mainPackage.name]
          });
        }
      });
    }

    function processAliasExpression(node) {
      var name = node.expression.arguments[1].value;
      var sourceName = node.expression.arguments[2].value;
      addSugarMethod(name, node, {
        body: true,
        requires: [getFullMethodKey(node, sourceName)],
      });
    }

    function writeModulePackage() {
      var body = [];
      iter(sugarMethods, function(name, package) {
        if (package.module === module) {
          var requirePath = getPathForRequire(path.join(package.path, package.name));
          body.push("require('"+ requirePath +"');");
        }
      });
      writePackage(module, {
        body: body.sort().join('\n'),
        exports: 'core',
      });
    }

    filePath = 'lib/' + module + '.js'
    source = fs.readFileSync(filePath, 'utf-8')

    output = acorn.parse(source, {
      locations: true,
      sourceFile: filePath,
      onComment: onComment
    });
    namespaceBoundary();

    output.body.forEach(function(node) {
      processTopLevelNode(node);
    });

    if (hasModuleBundle !== false) {
      writeModulePackage();
    }
  }

  function getPathForRequire(path) {
    if (path.charAt(0) !== '.') {
      path = './' + path;
    }
    return path;
  }

  function writeMethod(name, package) {
    // Need to write the package name, which is not
    // the same as it's fully qualified name in the
    // hash as we are avoiding namespace collisions.
    writePackage(package.name, package);
  }

  function writePackage(packageName, package) {

    if (package.alias) {
      // Don't export alias packages.
      return;
    }

    // "dependencies" are named and need to be mapped to variables.
    // "requires" must be required but do not need to be mapped.
    var deps = prepareDeps(package.dependencies), requires = package.requires;

    function prepareDeps(deps) {
      if (deps) {
        sortByLength(deps);
        return groupAliases(deps);
      }
    }

    function getRequires() {
      var blocks = [];

      if (package.core) {
        blocks.push('var Sugar = ' + getRequire(getSugarCorePath()) + ';\n');
      }
      if (deps && deps.length) {
        var namedRequiresBlock = deps.map(function(dep) {
          return dep + ' = ' + getRequire(getDependencyPath(dep));
        });
        blocks.push('var ' + namedRequiresBlock.join(',\n' + TAB + TAB) + ';\n');
      }
      if (requires && requires.length) {
        var unnamedRequiresBlock = requires.sort().map(function(dep) {
          return getRequire(getDependencyPath(dep)) + ';';
        });
        blocks.push(unnamedRequiresBlock.join('\n'));
      }
      return blocks.join('\n');
    }

    function getRequire(p) {
      return "require('" + p + "')";
    }

    function getAssigns() {
      var assigns = [];
      if (deps && deps.length) {
        deps.forEach(function(d) {
          var package = topLevel[d];
          var exports = package && package.exports;
          if (exports && typeof exports === 'object' && exports.length > 1) {
            exports.forEach(function(token) {
              assigns.push([token, ' = ', package.name, '.', token].join(''));
            });
          }
        });
        if (assigns.length) {
          sortByLength(assigns);
          return 'var ' + assigns.join(',\n' + TAB + TAB) + ';\n';
        }
      }
      return '';
    }

    function getExports() {
      var exports = package.exports, compiled, mapped;

      if (!exports) {
        // Some packages simply define methods and do not export.
        return '';
      }

      if (exports === 'core') {
        // Replace token "core" with either the sugar-core package
        // or its local path.
        exports = getRequire(getSugarCorePath());
      }

      if (typeof exports === 'string') {
        exports = [exports];
      }
      if (exports.length === 1) {
        compiled = exports[0];
      } else {
        mapped = exports.map(function(e) {
          return TAB + "'"+ e +"': " + e;
        });
        sortByLength(mapped);
        compiled = ['{', mapped.join(',\n'), '}'].join('\n');
      }
      return 'module.exports = ' + compiled + ';';
    }

    function groupAliases(deps) {
      var aliases = [];
      deps = deps.filter(function(d) {
        var package = topLevel[d];
        if (package && package.alias) {
          if (aliases.indexOf(package.alias) === -1) {
            aliases.push(package.alias);
          }
          return false;
        }
        return true;
      });
      return deps.concat(aliases);
    }

    function sortByLength(arr) {
      arr.sort(function(a, b) {
        return a.length - b.length;
      });
    }

    function getSugarCorePath() {
      // TODO: temporary until the core package is created.
      //return 'sugar-core';
      return path.relative(package.path || '', '../../../lib/core');
    }

    function getDependencyPath(dependencyName) {
      // Aliases may have dependencies on other sugar methods.
      var dependency = topLevel[dependencyName] || sugarMethods[dependencyName];
      if (!dependency) {
        console.info(package, dependencyName, dependency);
        throw new Error('Missing dependency: ' + dependencyName);
      }
      return getPathForRequire(getRelativePath(dependency));
    }

    function getRelativePath(dependency) {
      return path.join(path.relative(package.path, dependency.path), dependency.name);
    }

    function getBody() {
      return package.body || '';
    }

    function getInit() {
      return package.init || '';
    }

    function getOutputBody() {
      var strict = '"use strict";';
      if (package.type === 'internal' && package.exports) {
        // If the package is an internal function, then to avoid issues with
        // circular dependencies, hoist the package body and exports to the top
        // with an explicit message about the situation. Remember here that if
        // this is a "build" function, the initializer (buildXXX) still needs
        // to be run after the requires block, as the package dependencies will
        // not yet have been met.
        var body = [DECLARES_PREAMBLE, getBody()].join('\n');
        return join([strict, body, getExports(), getRequires(), getAssigns(), getInit()]);
      } else {
        // If this is a normal package then export normally.
        return join([strict, getRequires(), getAssigns(), getBody(), getInit(), getExports()]);
      }
    }

    function join(blocks) {
      return blocks.filter(function(block) {
        return block;
      }).join(BLOCK_DELIMITER);
    }

    var outputPath = path.join(NPM_DESTINATION, package.path || '');
    var outputFilePath = path.join(outputPath, packageName + '.js');
    var outputBody = getOutputBody();
    mkdirp.sync(outputPath);
    fs.writeFileSync(outputFilePath, outputBody, 'utf-8');
  }

  parseModule('common', false);
  parseModule('regexp');
  parseModule('number');
  parseModule('range');
  parseModule('function');
  parseModule('string');
  parseModule('inflections');
  parseModule('language');
  parseModule('array');
  parseModule('object');
  parseModule('date');

  //parseModule('es5'); + 1
  //parseModule('es6'); + 2

  iter(topLevel, writePackage);
  iter(sugarMethods, writeMethod);

}

gulp.task('modularize', function() {
  modularize();
});


// -------------- Test ----------------


gulp.task('test', function(cb) {
  reload('./test/node/watch.js');
  cb();
});

gulp.task('test-build', ['dev', 'npm'], function(cb) {
  reload('./test/node/watch.js');
  cb();
});

gulp.task('test:watch', function() {
  gulp.watch(['lib/**/*.js'], ['test-build']);
  gulp.watch(['test/**/*.js'], ['test']);
});


// -------------- Docs ----------------

gulp.task('docs', function() {
  var files = getFiles('all', true), packages = {}, methodsByNamespace = {};
  var output = args.f || args.file || 'docs.json';
  var basename = path.basename(output);
  var dirname = path.dirname(output);

  return gulp.src(files)
    .pipe(through.obj(function(file, enc, cb) {
      var text, lines, currentNamespace, currentPackage;

      text = file.contents.toString('utf-8')
      lines = text.split('\n');

      function extractMethodNameAndArgs(obj, str) {
        var match = str.match(/(\w+\.)?([^(]+)\(([^\)]*)\)/), args = [];
        var klass = match[1];
        var name  = match[2];

        match[3].split(',').forEach(function(a) {
          var o = a.split(' = '), arg = {};
          var required = true;
          var argName = o[0].trim().replace(/[<>]/g, '').replace(/[\[\]]/g, function(s) {
            required = false;
            return '';
          });
          if (!argName) {
            return;
          } else if (argName == '...') {
            obj['glob'] = true;
            return;
          }
          arg['name'] = argName;
          if (o[1]) {
            arg['default'] = o[1];
            arg['type'] = eval('typeof ' + o[1]);
          }
          if (!required) {
            arg['optional'] = true;
          }
          args.push(arg);
        });
        if (!klass) {
          obj['instance'] = true;
        }
        if (args.length) {
          obj['args'] = args;
        }
        return name;
      }

      function getLineNumber(name) {
        var lineNum;
        var reg = RegExp('@method ' + name + '\\b');
        lines.some(function(l, i) {
          if (l.match(reg)) {
            lineNum = i + 1;
            return true;
          }
        });
        return lineNum;
      }

      function switchNamespace(name) {
        currentNamespace = methodsByNamespace[name];
        if (!currentNamespace) {
          currentNamespace = methodsByNamespace[name] = {};
        }
      }

      function getMultiline(str) {
        var result = [], fOpen = false;
        str.split('\n').forEach(function(l) {
          l = l.replace(/^[\s*]+|[\s*]+$/g, '').replace(/\s+->.+$/, '');
          if (l) {
            if (fOpen) {
              result[result.length - 1] += '\n' + l;
            } else {
              result.push(l);
            }
          }
          if (l.match(/\{$/)) {
            fOpen = true;
          } else if (l.match(/^\}/)) {
            fOpen = false;
          }
        });
        return result;
      }

      function getFileSize(path) {
        return fs.statSync(path).size;
      }

      function getGzippedFileSize(path) {
        return zlib.gzipSync(fs.readFileSync(path, 'utf-8')).length;
      }

      function getPackageSize(package) {
        var name = package.replace(/\s/g, '_').toLowerCase();
        var dPath = PRECOMPILED_DEV_DIR + name + '.js';
        var mPath = PRECOMPILED_MIN_DIR + name + '.js';
        packages[package]['size'] = getFileSize(dPath);
        packages[package]['min_size'] = getGzippedFileSize(mPath);
      }

      text.replace(/\*\*\*([\s\S]+?)[\s\n*]*(?=\*\*\*)/gm, function(m, tags) {
        var obj = {};
        tags.replace(/@(\w+)\s?([^@]*)/g, function(all, key, val) {
          val = val.replace(/^[\s*]/gm, '').replace(/[\s*]+$/, '');
          switch(key) {
            case 'package':
              packages[val] = obj;
              currentPackage = val;
              if (DEFAULT_PACKAGES.indexOf(val.toLowerCase()) !== -1) {
                obj['supplemental'] = true;
              }
              switchNamespace(val);
              getPackageSize(val);
              break;
            case 'namespace':
              switchNamespace(val);
              break;
            case 'method':
              var name = extractMethodNameAndArgs(obj, val);
              obj.line = getLineNumber(name);
              obj.package = currentPackage;
              currentNamespace[name] = obj;
              break;
            case 'set':
              obj[key] = getMultiline(val);
              break;
            case 'example':
              obj[key] = getMultiline(val);
              break;
            default:
              obj[key] = val;
          }
        });
      });
      this.push(file);
      cb();
    }))
    .pipe(concat(basename, { newLine: '' }))
    .pipe(through.obj(function(file, enc, cb) {
      file.contents = new Buffer(JSON.stringify({
        packages: packages,
        methodsByNamespace: methodsByNamespace
      }), "utf8");
      this.push(file);
      cb();
    }))
    .pipe(gulp.dest(dirname));
});
