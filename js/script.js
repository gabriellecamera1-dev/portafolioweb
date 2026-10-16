// Precios: hoja de Google publicada como CSV (id,categoria,paquete,precio).
// Si falla o está vacía, se quedan los precios escritos en el HTML.
var GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSGTWQxuLdKxQti8RNHOqpEOIO9-bIBYa6PU_TflUfwZrsnzhnqGmSaiL931pxRkL4VP0UeFnUzHsL0/pub?gid=0&single=true&output=csv';

$(function () {
  var $magazine = $('#magazine');
  var PAGE_RATIO = 1.3;
  var MOBILE_RATIO = 1.414;
  var BREAKPOINT = 768;
  var MOBILE_GUTTER = 8;

  // Intro (02/03) desde la que se abrió un precio con "Ver paquetes". Mientras
  // exista, Volver/Siguiente en los precios se mueven ±1 desde esa intro.
  // Se borra al usarse, con "Continuar viendo galería" o al salir de precios.
  var paginaOrigen = null;

  function parsearCSV(texto) {
    var filas = [];
    var fila = [];
    var celda = '';
    var enComillas = false;
    for (var i = 0; i < texto.length; i++) {
      var c = texto.charAt(i);
      if (enComillas) {
        if (c === '"' && texto.charAt(i + 1) === '"') { celda += '"'; i++; }
        else if (c === '"') { enComillas = false; }
        else { celda += c; }
      } else if (c === '"') {
        enComillas = true;
      } else if (c === ',') {
        fila.push(celda); celda = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto.charAt(i + 1) === '\n') { i++; }
        fila.push(celda); filas.push(fila); fila = []; celda = '';
      } else {
        celda += c;
      }
    }
    if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }
    return filas;
  }

  function limpiarPrecio(valor) {
    var n = parseFloat(String(valor).replace(/[^\d.]/g, ''));
    return n > 0 ? n : null;
  }

  function formatearPrecio(n) {
    return '$' + n.toLocaleString('es-MX') + ' MXN';
  }

  // Se guardan antes de iniciar turn.js, que saca del DOM las páginas lejanas
  // (precios incluidos); los nodos desprendidos se siguen pudiendo editar.
  var $preciosHtml = $('[data-precio-id]');
  var $rangosHtml = $('[data-rango-categoria]');

  function aplicarPrecios(texto) {
    var filas = parsearCSV(texto);
    if (filas.length < 2) { return; }

    var encabezado = $.map(filas[0], function (h) { return $.trim(h).toLowerCase(); });
    var colId = $.inArray('id', encabezado);
    var colCategoria = $.inArray('categoria', encabezado);
    var colPrecio = $.inArray('precio', encabezado);
    if (colId < 0 || colPrecio < 0) { return; }

    var rangos = {};
    for (var i = 1; i < filas.length; i++) {
      var id = $.trim(filas[i][colId] || '');
      var precio = limpiarPrecio(filas[i][colPrecio] || '');
      if (!id || precio === null) { continue; }

      $preciosHtml.filter('[data-precio-id="' + id + '"]').text(formatearPrecio(precio));

      var categoria = colCategoria < 0 ? '' : $.trim(filas[i][colCategoria] || '').toLowerCase();
      if (categoria) {
        var r = rangos[categoria] || (rangos[categoria] = { min: precio, max: precio });
        r.min = Math.min(r.min, precio);
        r.max = Math.max(r.max, precio);
      }
    }

    $.each(rangos, function (categoria, r) {
      var texto = r.min === r.max
        ? formatearPrecio(r.min)
        : '$' + r.min.toLocaleString('es-MX') + ' – ' + formatearPrecio(r.max);
      $rangosHtml.filter('[data-rango-categoria="' + categoria + '"]').text(texto);
    });
  }

  function cargarPreciosDesdeSheet() {
    var url = $.trim(GOOGLE_SHEET_CSV_URL || '');
    if (!url || !window.fetch) { return; }
    // Con file:// Google no da CORS y el error en consola no se puede callar.
    if (location.protocol === 'file:') { return; }

    fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.text();
      })
      .then(aplicarPrecios)
      .catch(function () {});
  }

  cargarPreciosDesdeSheet();

  if (!$.fn.turn) {
    console.error('turn.js no se cargó; la revista se muestra sin animación.');
    return;
  }

  var $pages = $magazine.children('.page');
  $pages.each(function (i) {
    $(this).toggleClass('odd', i % 2 === 0).toggleClass('even', i % 2 === 1);
  });

  $pages.each(function (i) {
    var $nav = $('<nav class="page-nav" aria-label="Navegación de la revista"></nav>');
    if (i > 0) {
      $nav.append('<button type="button" class="nav-prev">&lsaquo; Volver</button>');
    }
    if (i < $pages.length - 1) {
      $nav.append('<button type="button" class="nav-next">Siguiente &rsaquo;</button>');
    }
    $(this).append($nav);
  });

  var paginasPrecios = [];
  $pages.each(function (i) {
    if ($(this).hasClass('page-prices')) paginasPrecios.push(i + 1);
  });

  // turn.js mide sin padding: maneja este envoltorio y .page lo llena al 100%.
  $pages.wrap('<div class="page-sheet"></div>');

  function getLayout() {
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var single = vw < BREAKPOINT;
    var pageWidth, ratio;

    if (single) {
      ratio = MOBILE_RATIO;
      pageWidth = Math.min(vw - MOBILE_GUTTER * 2, (vh - MOBILE_GUTTER * 2) / ratio);
    } else {
      ratio = PAGE_RATIO;
      pageWidth = Math.min((vw - 32) / 2, (vh - 48) / ratio, 520);
    }
    pageWidth = Math.floor(pageWidth);

    return {
      display: single ? 'single' : 'double',
      width: single ? pageWidth : pageWidth * 2,
      height: Math.floor(pageWidth * ratio),
      fontSize: pageWidth / 30
    };
  }

  var layout = getLayout();
  $magazine.css('font-size', layout.fontSize + 'px');
  $magazine.toggleClass('is-single', layout.display === 'single');

  $magazine.turn({
    width: layout.width,
    height: layout.height,
    display: layout.display,
    autoCenter: true,
    gradients: true,
    acceleration: true,
    elevation: 50,
    when: {
      turning: function () {
        var sound = document.getElementById('flip-sound');
        if (!sound) return;
        try {
          sound.currentTime = 0;
          var playing = sound.play();
          if (playing && playing.catch) playing.catch(function () {});
        } catch (err) {}
      },
      turned: function (e, page) {
        if (paginasPrecios.indexOf(page) === -1) paginaOrigen = null;
      }
    }
  });

  var resizeTimer;
  $(window).on('resize orientationchange', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var next = getLayout();
      $magazine.css('font-size', next.fontSize + 'px');
      $magazine.toggleClass('is-single', next.display === 'single');
      if ($magazine.turn('display') !== next.display) {
        $magazine.turn('display', next.display);
      }
      $magazine.turn('size', next.width, next.height);
    }, 150);
  });

  // Evita que turn.js tome el clic de un botón como arrastre de esquina.
  $magazine.on('mousedown touchstart', '.page-nav button, .cover-next, [data-goto]', function (e) {
    e.stopPropagation();
  });

  $magazine.on('click', '.cover-next', function () {
    $magazine.turn('next');
  });

  function moverDesdeOrigen(boton, paso) {
    if (paginaOrigen === null || !$(boton).closest('.page-prices').length) return false;
    var destino = paginaOrigen + paso;
    paginaOrigen = null;
    $magazine.turn('page', destino);
    return true;
  }

  $magazine.on('click', '.nav-prev', function () {
    if (!moverDesdeOrigen(this, -1)) $magazine.turn('previous');
  });

  $magazine.on('click', '.nav-next', function () {
    if (!moverDesdeOrigen(this, 1)) $magazine.turn('next');
  });

  $magazine.on('click', '[data-goto]', function (e) {
    e.preventDefault();
    if ($(this).hasClass('btn-paquetes')) {
      // Página del botón, no turn('page'): en doble página puede dar la otra del pliego.
      paginaOrigen = $pages.index($(this).closest('.page')) + 1;
    }
    if ($(this).hasClass('btn-continue')) {
      paginaOrigen = null;
    }
    $magazine.turn('page', Number($(this).data('goto')));
  });

  $magazine[0].addEventListener('toggle', function (e) {
    var box = e.target;
    if (!box.open || !$(box).hasClass('info-box')) return;
    var list = $(box).closest('.accordion')[0];
    var body = $(box).closest('.package-body')[0];
    var listRect = list.getBoundingClientRect();
    var overflow = Math.min(
      body.getBoundingClientRect().bottom - listRect.bottom,
      box.getBoundingClientRect().top - listRect.top
    );
    if (overflow > 0) {
      $(list).animate({ scrollTop: list.scrollTop + overflow }, 300);
    }
  }, true);

  $(document).on('keydown', function (e) {
    if (e.key === 'ArrowLeft') $magazine.turn('previous');
    if (e.key === 'ArrowRight') $magazine.turn('next');
  });
});
