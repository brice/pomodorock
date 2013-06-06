// app.js

// variable initialization
var time = moment().startOf('hour').add('minutes', 25);
var alert_name = "pomodoro";
var interval;
var bb = new BankersBox();

/*
 * Increment counter (pomodoros or interruptions)
 */
function incrementCounter(element) {
    var target = element.attr("data-target");
    bb.incr(getKey(target));
    bb.sadd('index:dates', moment().format('YYYY-MM-DD'));
    // We increment: we're trying to fetch task name
    var taskname = $('#taskname').val();
    if (taskname && target == 'pomodoros') {
        bb.incr('task:'+taskname);
        bb.incr(getKey('task:'+taskname));
    }
    refresh();
}

/*
 * Decrement counter
 */
function decrementCounter(element) {
    var target = $(element).attr("data-target");
    bb_key = getKey(target);
    if (bb.get(bb_key) == 0) return;
    bb.decr(bb_key);
    // We decrement
    var taskname = $('#taskname').val();
    if (taskname && target == 'pomodoros') {
        bb.decr('task:'+taskname);
        bb.decr(getKey('task:'+taskname));
    }
    refresh();
}

function incrementTask(element) {
    var taskname = $(element).attr('data-target');
    var pomodoro_key = getKey('pomodoros');
    bb.incr(pomodoro_key);
    bb.incr('task:'+taskname);
    bb.incr(getKey('task:'+taskname));
    refresh();
}
function decrementTask(element) {
    var taskname = $(element).attr('data-target');
    var pomodoro_key = getKey('pomodoros');
    // do not decrement
    if (bb.get(pomodoro_key) == 0) return;
    if (bb.get('task:'+taskname) == 0) return;

    bb.decr(pomodoro_key);
    bb.decr('task:'+taskname);
    bb.decr(getKey('task:'+taskname));
    refresh();
}

/*
 * Helper: get the BankersBox key
 */
function getKey(key) {
    return moment().format('YYYY-MM-DD') + ':' + key;
}

// -------- UI section

/*
 * refresh Counter on the webpage
 */
function refreshKey(key) {
    var bb_key = getKey(key);
    bb.sadd('index:dates', moment().format('YYYY-MM-DD'));
    if (!bb.exists(bb_key)) {
        bb.set(bb_key, 0);
    }
    $('#'+key).html(bb.get(bb_key));
}

/*
 * Refresh stats (sparklines)
 */
function getStats() {
    var pomodoros = [];
    var interruptions = [];
    var dates = bb.smembers('index:dates');
    dates.sort();
    dates = dates.slice(-20);
    for (var i in dates) {
        key = dates[i];
        if (bb.exists(key+':pomodoros')) {
            pomodoros.push(bb.get(key+':pomodoros'));
        } else {
            pomodoros.push(0);
        }
        if (bb.exists(key+':interruptions')) {
            interruptions.push(bb.get(key+':interruptions'));
        } else {
            interruptions.push(0);
        }
    };
    var data = zip([pomodoros, interruptions]);
    $('#sparkline').sparkline(data, { type: 'bar' });

    // get task pomodoros
    var sortable = [];
    var today = moment().format('YYYY-MM-DD');
    for (var i in bb.keys()) {
        key = bb.keys()[i];
        if (key.startsWith(today+':task')) {
            var nb = bb.get(key);
            var taskname = key.replace(today+':task:', '');
            sortable.push([taskname, nb]);
        }
    }
    sortable.sort(function(a, b) { return b[1] - a[1]});
    $('#dailytasks').empty();
    var pattern = '<tr><td>{0}</td><td>{1}</td><td>' +
        '<button class="btn btn-mini btn-danger decr-task" data-target="{0}"><i class="icon icon-minus"></i></button> ' +
        '<button class="btn btn-mini btn-primary incr-task" data-target="{0}"><i class="icon icon-plus"></i></button>' +
        '</td></tr>';
    for (var i in sortable) {
        $('#dailytasks').append(pattern.format(sortable[i][0], sortable[i][1]));
    }
    $('.incr-task').click(function() {
        incrementTask(this);
    });
    $('.decr-task').click(function() {
        decrementTask(this);
    });
}

/*
 * Full refresh of the counters and stats on the UI
 */
function refresh() {
    refreshKey('pomodoros');
    refreshKey('interruptions');
    getStats();
}

// -------- Timer section

/*
 * Update timer on the UI
 */
function updateTimer() {
    time.subtract(1, 'seconds');
    $('#time').html(time.format('mm:ss'));
    document.title = time.format('mm:ss') + " - Pomodorock";
    if (time.minute() == 0 && time.seconds() == 0) {
        notify();
        resetTimer();
        document.title = "DONE - Pomodorock";
    }
}
/*
 * Reset timer
 */
function resetTimer() {
    $('#time').html('waiting...');
    clearInterval(interval);
}

/*
 * Trigger notification (visual and audio)
 */
function notify() {
    $('#timer-alert-'+alert_name).show();
    var snd = new Audio("./static/vendor/tada.wav");
    snd.play();
}



$(document).ready(function() {

    migrate();
    refresh();

    // Start button event
    $('.btn-start').click(function() {
        // Hide alerts
        $('.alert').hide();
        // initialize timer
        time = moment().startOf('hour').add('minutes', $(this).attr('data-time'));
        // This "alert_name" object will be shown when the timer will be over.
        alert_name = $(this).attr('data-alert-name');
        $('#time').html(time.format('mm:ss'));
        // Interval call.
        interval = setInterval("updateTimer()", 1000);
    });

    // Stop button event
    $('#btn-stop').click(function() {
        $('.alert').hide();
        document.title = "Pomodorock";
        resetTimer();
    })

    // Increment button event
    $('.incr').click(function() {
        incrementCounter($(this));
    });
    // Decrement button event
    $('.decr').click(function() {
        decrementCounter($(this))
    });

    // DB Operation button event
    $('#db-operations').click(function() {
        $('.db-operations').toggle();
        $('.on-restore, .on-backup, textarea#dbcontent, .dbcontent').hide();
    });
    // DB Backup button event
    $('#backup').click(function() {
        $('textarea#dbcontent').val(localStorage.dumps()); // DB serialization
        $('.on-restore').hide();
        $('.on-backup, textarea#dbcontent').show();
    });
    // DB Restore "start" button event - display restore interface
    $('#restore-start').click(function() {
        $('.on-backup').hide();
        $('.on-restore, textarea#dbcontent').show();
    });
    // Restore button event.
    $('#restore').click(function() {
        localStorage.loads($('textarea#dbcontent').val());
        // Note: this looks like a dirty trick, but it looks like calling refresh()
        // does not refresh the counter correctly.
        // FIXME: find a better way.
        var timeId = window.setTimeout(function() {document.location.href = '.';}, 1500);
    })

});