$(function () {
  var $magazine = $('#magazine');
  var PAGE_RATIO = 1.3; // alto / ancho de cada página
  var MOBILE_RATIO = 1.414; // en móvil, proporción A4: más alto para texto legible
  var BREAKPOINT = 768; // debajo de esto se muestra una sola página
  var MOBILE_GUTTER = 8; // margen a cada lado de la página en móvil

  // Página desde la que se saltó a los precios con "Ver paquetes". Sin
  // esto, Volver en los precios iba a la página anterior (la galería
  // masculina) en vez de regresar a la intro de donde vino la persona.
  var paginaOrigen = null;

  if (!$.fn.turn) {
    console.error('turn.js no se cargó; la revista se muestra sin animación.');
    return;
  }

  // Marca cada página según su lado en doble página (1 = derecha/odd,
  // 2 = izquierda/even...). Así se pueden añadir o quitar páginas en el
  // HTML sin tocar clases a mano; el CSS usa .odd/.even para el lomo.
  var $pages = $magazine.children('.page');
  $pages.each(function (i) {
    $(this).toggleClass('odd', i % 2 === 0).toggleClass('even', i % 2 === 1);
  });

  // Navegación dentro de cada página (sin Volver en la primera ni
  // Siguiente en la última). El CSS decide cuál se ve según el lado.
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

  // Números de las páginas de precios (1 = portada), para saber cuándo
  // se sale de ellas sin usar Volver.
  var paginasPrecios = [];
  $pages.each(function (i) {
    if ($(this).hasClass('page-prices')) paginasPrecios.push(i + 1);
  });

  // turn.js mide cada hoja con .width()/.height() de jQuery, que no
  // cuentan el padding. Con el padding en la hoja, el pliegue se calculaba
  // sobre una página más chica y la recortaba al pasar. Por eso turn.js
  // maneja un envoltorio sin padding y .page lo llena al 100%.
  $pages.wrap('<div class="page-sheet"></div>');

  // Calcula el tamaño del libro según el espacio disponible. En móvil la
  // página ocupa casi todo el ancho (como Google Books) y solo se achica
  // si la pantalla no tiene alto suficiente para la proporción vertical.
  // Se mide con clientWidth/Height (viewport de layout): en móvil
  // innerWidth crece si algo se desborda antes de que turn.js ajuste el
  // tamaño, y el libro quedaba más ancho que la pantalla y recortado.
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
      // Sonido al hojear. play() devuelve una promesa: si el navegador
      // bloquea el audio, el rechazo llega asíncrono y el try/catch no lo
      // atrapa, por eso también se ignora con .catch().
      turning: function () {
        var sound = document.getElementById('flip-sound');
        if (!sound) return;
        try {
          sound.currentTime = 0; // reinicia si se hojea rápido
          var playing = sound.play();
          if (playing && playing.catch) playing.catch(function () {});
        } catch (err) {}
      },
      // Si se sale de los precios por otro camino (Siguiente, teclado,
      // arrastre), el origen ya no aplica: Volver vuelve a ser normal.
      turned: function (e, page) {
        if (paginasPrecios.indexOf(page) === -1) paginaOrigen = null;
      }
    }
  });

  // Ajuste al cambiar el tamaño de la ventana
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

  // Navegación integrada. Se corta mousedown/touchstart para que turn.js
  // no lo tome como el inicio de un arrastre de esquina (los botones
  // están justo en las esquinas inferiores) y pase dos páginas.
  $magazine.on('mousedown touchstart', '.page-nav button, .cover-next, [data-goto]', function (e) {
    e.stopPropagation();
  });

  // Botón SIGUIENTE del bloque "Portafolio" de la portada
  $magazine.on('click', '.cover-next', function () {
    $magazine.turn('next');
  });

  // En los precios, si se llegó con "Ver paquetes", Volver y Siguiente
  // actúan como si se siguiera en la intro de origen: desde la 03, Volver
  // lleva a la 02 y Siguiente a la 04; desde la 02, a la portada y a la 03.
  // Antes iban a la galería masculina o a la contraportada ("cerraba la
  // revista"). paso es -1 o +1. Devuelve true si hizo el salto.
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

  // Enlaces internos: data-goto="N" lleva a la página N
  $magazine.on('click', '[data-goto]', function (e) {
    e.preventDefault();
    // Se toma el número de la página donde está el botón y no
    // turn('page'): en doble página turn.js puede dar la otra del pliego.
    if ($(this).hasClass('btn-paquetes')) {
      paginaOrigen = $pages.index($(this).closest('.page')) + 1;
    }
    // "Continuar viendo galería" lleva al inicio de la galería (20 Retrato,
    // 04 Boudoir): ahí Volver ya no debe regresar a la intro de origen.
    if ($(this).hasClass('btn-continue')) {
      paginaOrigen = null;
    }
    $magazine.turn('page', Number($(this).data('goto')));
  });

  // Al abrir "Leer info importante" la lista de paquetes puede quedar
  // más alta que la página y desplazarse por dentro: se baja lo justo para
  // que el aviso y su botón de reserva queden a la vista. "toggle" no
  // burbujea, por eso se escucha en fase de captura.
  $magazine[0].addEventListener('toggle', function (e) {
    var box = e.target;
    if (!box.open || !$(box).hasClass('info-box')) return;
    var list = $(box).closest('.accordion')[0];
    var body = $(box).closest('.package-body')[0];
    var listRect = list.getBoundingClientRect();
    // Sin pasar del inicio del aviso, por si no cabe completo
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
