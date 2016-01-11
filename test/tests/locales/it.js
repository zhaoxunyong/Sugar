namespace('Dates Italian', function () {
  "use strict";

  var now, then;

  setup(function() {
    now = new Date();
    then = new Date(2010, 0, 5, 15, 52);
    testSetLocale('it');
  });

  method('create', function() {

    equal(testCreateDate('15 Maggio 2011'), new Date(2011, 4, 15), 'Date#create | basic Italian date');
    equal(testCreateDate('Martedì, 5 Gennaio 2012'), new Date(2012, 0, 5), '2012-01-05');
    equal(testCreateDate('Maggio 2011'), new Date(2011, 4), 'year and month');
    equal(testCreateDate('15 Maggio'), new Date(now.getFullYear(), 4, 15), 'month and date');
    equal(testCreateDate('2011'), new Date(2011, 0), 'year');
    equal(testCreateDate('Maggio'), new Date(now.getFullYear(), 4), 'month');
    equal(testCreateDate('Lunedì'), getDateWithWeekdayAndOffset(1), 'Monday');
    equal(testCreateDate('Lun'), getDateWithWeekdayAndOffset(1), 'Monday abbreviated');

    equal(testCreateDate('Martedì, 5 Gennaio 2012 3:45'), new Date(2012, 0, 5, 3, 45), '2012-01-05 3:45');
    equal(testCreateDate('Martedì, 5 Gennaio 2012 3:45pm'), new Date(2012, 0, 5, 15, 45), '2012-01-05 3:45pm');

    equal(testCreateDate('un millisecondo fa'), getRelativeDate(null, null, null, null, null, null,-1), 'one millisecond ago');
    equal(testCreateDate('un secondo fa'), getRelativeDate(null, null, null, null, null, -1), 'one second ago');
    equal(testCreateDate('un minuto fa'), getRelativeDate(null, null, null, null, -1), 'one minuto ago');
    equal(testCreateDate("un'ora fa"), getRelativeDate(null, null, null, -1), 'one hour ago');
    equal(testCreateDate('un giorno fa'), getRelativeDate(null, null, -1), 'one day ago');
    equal(testCreateDate('una settimana fa'), getRelativeDate(null, null, -7), 'one week ago');
    equal(testCreateDate('un mese fa'), getRelativeDate(null, -1), 'one month ago');
    equal(testCreateDate('un anno fa'), getRelativeDate(-1), 'one year ago');


    equal(testCreateDate('5 millisecondi da adesso'), getRelativeDate(null, null, null, null, null, null,5), 'danni | five milliseconds from now');
    equal(testCreateDate('5 secondi da adesso'), getRelativeDate(null, null, null, null, null, 5), 'danni | five second from now');
    equal(testCreateDate('5 minuti da adesso'), getRelativeDate(null, null, null, null, 5), 'danni | five minuto from now');
    equal(testCreateDate('5 ore da adesso'), getRelativeDate(null, null, null, 5), 'danni | five hour from now');
    equal(testCreateDate('5 giorni da adesso'), getRelativeDate(null, null, 5), 'danni | five day from now');
    equal(testCreateDate('5 settimane da adesso'), getRelativeDate(null, null, 35), 'danni | five weeks from now');
    equal(testCreateDate('5 mesi da adesso'), getRelativeDate(null, 5), 'danni | five months from now');
    equal(testCreateDate('5 anni da adesso'), getRelativeDate(5), 'danni | five years from now');


    equal(testCreateDate('ieri'), run(getRelativeDate(null, null, -1), 'reset'), 'yesterday');
    equal(testCreateDate('oggi'), run(getRelativeDate(null, null, 0), 'reset'), 'today');
    equal(testCreateDate('domani'), run(getRelativeDate(null, null, 1), 'reset'), 'tomorrow');
    equal(testCreateDate('dopodomani'), run(getRelativeDate(null, null, 2), 'reset'), 'day after tomorrow');

    equal(testCreateDate('la settimana scorsa'), getRelativeDate(null, null, -7), 'Last week');
    equal(testCreateDate('la settimana prossima'), getRelativeDate(null, null, 7), 'Next week');

    equal(testCreateDate('il mese scorso'), getRelativeDate(null, -1), 'last month');
    equal(testCreateDate('il mese prossimo'), getRelativeDate(null, 1), 'Next month');

    equal(testCreateDate("l'anno scorso"), getRelativeDate(-1), 'Last year');
    equal(testCreateDate("l'anno prossimo"), getRelativeDate(1), 'Next year');

    equal(testCreateDate("prossimo lunedì"), getDateWithWeekdayAndOffset(1, 7), 'next monday');
    equal(testCreateDate("scorsa lunedì"), getDateWithWeekdayAndOffset(1, -7), 'last monday');

    equal(testCreateDate("scorsa lunedì 3:45"), run(getDateWithWeekdayAndOffset(1, -7), 'set', [{ hour: 3, minute: 45 }, true]), 'last monday 3:45');

    // No accents
    equal(testCreateDate('Martedi, 5 Gennaio 2012'), new Date(2012, 0, 5), 'no accents | 2012-01-05');
    equal(testCreateDate('Lunedi'), getDateWithWeekdayAndOffset(1), 'no accents | Monday');

    // Issue #152 Italian should not use a variant in any format
    equal(testCreateDate('15/3/2012 12:45'), new Date(2012, 2, 15, 12, 45), 'slash format with time');
    equal(testCreateDate('12:45 15/3/2012'), new Date(2012, 2, 15, 12, 45), 'slash format with time front');

    // Issue #150 Fully qualified ISO codes should be allowed
    equal(testCreateDate('7 gennaio 2012', 'it_IT'), new Date(2012, 0, 7), 'it_IT');
    equal(testCreateDate('7 gennaio 2012', 'it-IT'), new Date(2012, 0, 7), 'it-IT');

    // Issue #150 Unrecognized locales will result in invalid dates, but will not throw an error
    // Update: Now it will fall back to the current locale.
    equal(run(testCreateDate('7 gennaio 2012', 'ux_UX'), 'isValid'), true, 'unknown locale code');
    equal(run(testCreateDate('2012/08/25', 'ux_UX'), 'isValid'), true, 'System intelligible formats are still parsed');

    equal(testCreateDate('17:32 18 agosto'), new Date(now.getFullYear(), 7, 18, 17, 32), 'August 18, 17:32');

    equal(testCreateDate('domani alle 3:30'), run(getRelativeDate(null, null, 1), 'set', [{hours:3,minutes:30}, true]), 'tomorrow at 3:30');


    // Numbers

    equal(testCreateDate('zero anni fa'),    getRelativeDate(0),   'zero years ago');
    equal(testCreateDate('un anno fa'),      getRelativeDate(-1),  'one year ago');
    equal(testCreateDate('due anni fa'),     getRelativeDate(-2),  'two years ago');
    equal(testCreateDate('tre anni fa'),     getRelativeDate(-3),  'three years ago');
    equal(testCreateDate('quattro anni fa'), getRelativeDate(-4),  'four years ago');
    equal(testCreateDate('cinque anni fa'),  getRelativeDate(-5),  'five years ago');
    equal(testCreateDate('sei anni fa'),     getRelativeDate(-6),  'six years ago');
    equal(testCreateDate('sette anni fa'),   getRelativeDate(-7),  'seven years ago');
    equal(testCreateDate('otto anni fa'),    getRelativeDate(-8),  'eight years ago');
    equal(testCreateDate('nove anni fa'),    getRelativeDate(-9),  'nine years ago');
    equal(testCreateDate('dieci anni fa'),   getRelativeDate(-10), 'ten years ago');

  });


  method('format', function() {

    test(then, '5 gennaio 2010 15:52', 'default format');

    assertFormatShortcut(then, 'short', '05/01/2010');
    assertFormatShortcut(then, 'medium', '5 gennaio 2010');
    assertFormatShortcut(then, 'long', '5 gennaio 2010 15:52');
    assertFormatShortcut(then, 'full', 'martedì, 5 gennaio 2010 15:52');
    test(then, ['{time}'], '15:52', 'preferred time');
    test(then, ['{stamp}'], 'mar 5 gen 2010 15:52', 'preferred stamp');
    test(then, ['%c'], 'mar 5 gen 2010 15:52', '%c stamp');

    test(new Date('January 3, 2010'), ['{w}'], '53', 'locale week number | Jan 3 2010');
    test(new Date('January 3, 2010'), ['{ww}'], '53', 'locale week number padded | Jan 3 2010');
    test(new Date('January 3, 2010'), ['{wo}'], '53rd', 'locale week number ordinal | Jan 3 2010');
    test(new Date('January 4, 2010'), ['{w}'], '1', 'locale week number | Jan 4 2010');
    test(new Date('January 4, 2010'), ['{ww}'], '01', 'locale week number padded | Jan 4 2010');
    test(new Date('January 4, 2010'), ['{wo}'], '1st', 'locale week number ordinal | Jan 4 2010');

    test(new Date(2015, 10, 8),  ['{Dow}'], 'dom', 'Sun');
    test(new Date(2015, 10, 9),  ['{Dow}'], 'lun', 'Mon');
    test(new Date(2015, 10, 10), ['{Dow}'], 'mar', 'Tue');
    test(new Date(2015, 10, 11), ['{Dow}'], 'mer', 'Wed');
    test(new Date(2015, 10, 12), ['{Dow}'], 'gio', 'Thu');
    test(new Date(2015, 10, 13), ['{Dow}'], 'ven', 'Fri');
    test(new Date(2015, 10, 14), ['{Dow}'], 'sab', 'Sat');

    test(new Date(2015, 0, 1),  ['{Mon}'], 'gen', 'Jan');
    test(new Date(2015, 1, 1),  ['{Mon}'], 'feb', 'Feb');
    test(new Date(2015, 2, 1),  ['{Mon}'], 'mar', 'Mar');
    test(new Date(2015, 3, 1),  ['{Mon}'], 'apr', 'Apr');
    test(new Date(2015, 4, 1),  ['{Mon}'], 'mag', 'May');
    test(new Date(2015, 5, 1),  ['{Mon}'], 'giu', 'Jun');
    test(new Date(2015, 6, 1),  ['{Mon}'], 'lug', 'Jul');
    test(new Date(2015, 7, 1),  ['{Mon}'], 'ago', 'Aug');
    test(new Date(2015, 8, 1),  ['{Mon}'], 'set', 'Sep');
    test(new Date(2015, 9, 1),  ['{Mon}'], 'ott', 'Oct');
    test(new Date(2015, 10, 1), ['{Mon}'], 'nov', 'Nov');
    test(new Date(2015, 11, 1), ['{Mon}'], 'dic', 'Dec');

  });


  method('relative', function() {
    assertRelative('1 second ago', '1 secondo fa');
    assertRelative('1 minute ago', '1 minuto fa');
    assertRelative('1 hour ago',   '1 ora fa');
    assertRelative('1 day ago',    '1 giorno fa');
    assertRelative('1 week ago',   '1 settimana fa');
    assertRelative('1 month ago',  '1 mese fa');
    assertRelative('1 year ago',   '1 anno fa');

    assertRelative('2 seconds ago', '2 secondi fa');
    assertRelative('2 minutes ago', '2 minuti fa');
    assertRelative('2 hours ago',   '2 ore fa');
    assertRelative('2 days ago',    '2 giorni fa');
    assertRelative('2 weeks ago',   '2 settimane fa');
    assertRelative('2 months ago',  '2 mesi fa');
    assertRelative('2 years ago',   '2 anni fa');

    assertRelative('1 second from now', '1 secondo da adesso');
    assertRelative('1 minute from now', '1 minuto da adesso');
    assertRelative('1 hour from now',   '1 ora da adesso');
    assertRelative('1 day from now',    '1 giorno da adesso');
    assertRelative('1 week from now',   '1 settimana da adesso');
    assertRelative('1 year from now',   '1 anno da adesso');

    assertRelative('5 second from now', '5 secondi da adesso');
    assertRelative('5 minutes from now','5 minuti da adesso');
    assertRelative('5 hour from now',   '5 ore da adesso');
    assertRelative('5 day from now',    '5 giorni da adesso');
    assertRelative('5 week from now',   '1 mese da adesso');
    assertRelative('5 year from now',   '5 anni da adesso');
  });

  method('beginning/end', function() {
    equal(dateRun(new Date(2010, 0), 'beginningOfWeek'), new Date(2009, 11, 28), 'beginningOfWeek');
    equal(dateRun(new Date(2010, 0), 'endOfWeek'), new Date(2010, 0, 3, 23, 59, 59, 999), 'endOfWeek');
  });

});

namespace('Number | Italian Dates', function () {

  method('duration', function() {
    test(run(5, 'hours'), ['it'], '5 ore', 'simple duration');
  });

});

