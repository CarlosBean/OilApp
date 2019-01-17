class OilTank {
    constructor(id, timeInMs, liters, idProgressBar, idVolumeControl, idPercentage, idCountdown, idValve) {
        this.id = id;
        this.timeInMs = timeInMs;
        this.liters = liters;
        this.idProgressBar = idProgressBar;
        this.idVolumeControl = idVolumeControl;
        this.idPercentage = idPercentage;
        this.idCountdown = idCountdown;
        this.idValve = idValve;
    }
}

const PROGRESS_BAR_IDS = $('#mainForm div[role="progressbar"]')
    .map(function () { return this.id; })
    .get();

const COUNTDOWN_IDS = $('#mainForm span[role="countdown"]')
    .map(function () { return this.id; })
    .get();

const VOLUME_IDS = $('#mainForm span[role="tankvolume"]')
    .map(function () { return this.id; })
    .get();

const LABEL_BAR_IDS = $('#mainForm small[role="labelbar"]')
    .map(function () { return this.id; })
    .get();

const VALVE_IDS = $('#valves i')
    .map(function () { return this.id; })
    .get();

const OIL_MS = 2000;

/* let tankTimeInSecList = [5, 15, 10]; */
let tankTimeInSecList = [];
let tankArray = [];
let mainProcessActive = false;

mainSwitch(false);

function start() {

    const INPUT_VALUES = $('#mainForm').serialize().split('&');
    let isCompleteForm = INPUT_VALUES.every(input => input.slice(-1) !== "=");

    if (isCompleteForm) {
        $.post($("#mainForm").attr('action'), $('#mainForm').serialize(), () => {

            $.get('tiempo_t1.htm', res => {
                tankTimeInSecList[0] = parseInt(res.trim());

                $.get('tiempo_t2.htm', res => {
                    tankTimeInSecList[1] = parseInt(res.trim());

                    $.get('tiempo_t3.htm', res => {
                        tankTimeInSecList[2] = parseInt(res.trim());
                        console.log(`Tiempos: T1-${tankTimeInSecList[0]}seg | T2-${tankTimeInSecList[1]}seg | T3-${tankTimeInSecList[2]}seg`);
                        mainProcess(INPUT_VALUES);
                    });
                });
            });
        });

        /* mainProcess(INPUT_VALUES); */

    } else {
        Swal({
            title: 'Atención',
            text: 'Se debe llenar todos los campos del formulario.',
            type: 'warning',
            confirmButtonText: 'Cerrar'
        });
    }
}

/* jshint ignore:start */
async function mainProcess(inputArray) {

    const TANK_LITERS = inputArray
        .filter(value => value.includes('Tanque'))
        .map(value => parseInt(value.slice(value.indexOf('=') + 1)));

    for (let tank = 0; tank < TANK_LITERS.length; tank++) {

        const timeInMs = tankTimeInSecList[tank] * 1000;
        const liters = TANK_LITERS[tank];
        const idProgressBar = PROGRESS_BAR_IDS[tank];
        const idVolumeControl = VOLUME_IDS[tank];
        const idPercentage = LABEL_BAR_IDS[tank];
        const idCountdown = COUNTDOWN_IDS[tank];
        const idValve = VALVE_IDS[tank];

        const minutes = convertMsTo(timeInMs, 'min');
        const seconds = convertMsTo(timeInMs, 'sec');

        $('#' + idCountdown).text(`${minutes} min : ${seconds} seg`);
        $('#' + idVolumeControl).text(`0 lt / ${liters} lt`);
        tankArray.push(new OilTank(tank, timeInMs, liters, idProgressBar, idVolumeControl, idPercentage, idCountdown, idValve));
    }

    console.log('Proceso inicializado');
    mainSwitch(true);

    for await (const tank of tankArray) {
        if (mainProcessActive) {
            if (tank.liters > 0) {
                openValves(tank.idValve);
                await waitOil(OIL_MS);
                countdown(tank);
                await loader(tank);
            } else {
                console.log(`Cancelado: T${tank.id + 1} | 0 lt`);
            }
        } else {
            console.log('Proceso detenido');
        }
    }

    mainSwitch(false);
    console.log('Proceso finalizado');
}
/* jshint ignore:end */

function stop() {
    $.post($('#mainForm').attr('action'), { '"Stop"': '1' }, () => {
        mainSwitch(false);
    });

    /* mainSwitch(false); */
}

function waitOil(ms) {
    setDeviceStatus('motorpump', false);
    console.log('Cebando motobomba...');
    return new Promise(resolve => setTimeout(resolve, ms));
}

function openValves(idValve) {
    VALVE_IDS.forEach(valve => setDeviceStatus(valve, false));
    setDeviceStatus(idValve, true);
}

function mainSwitch(isON) {
    if (isON) {
        mainProcessActive = true;
        $('#start').prop('disabled', true).css('cursor', 'not-allowed');
        setDeviceStatus('process', true);
        $('#tankInput1, #tankInput2, #tankInput3').prop('disabled', true);
        PROGRESS_BAR_IDS.forEach(bar => $('#' + bar).attr('aria-valuenow', 1).width(1 + '%'));

    } else {
        tankArray = [];
        mainProcessActive = false;
        $('#start').prop('disabled', false).css('cursor', 'pointer');
        setDeviceStatus('motorpump', false);
        setDeviceStatus('process', false);
        VALVE_IDS.forEach(valve => setDeviceStatus(valve, false));
        // PROGRESS_BAR_IDS.forEach(bar => $('#' + bar).attr('aria-valuenow', 1).width(1 + '%'));
        COUNTDOWN_IDS.forEach(timer => $('#' + timer).text('0 min : 0 seg'));
        // VOLUME_IDS.forEach(volume => $('#' + volume).text('0 lt / 0 lt'));
        $('#tankInput1, #tankInput2, #tankInput3').prop('disabled', false).val("");
    }
}

function setDeviceStatus(device, isActive) {
    if (isActive) {
        $('#' + device).addClass('led-on').removeClass('led-off');
    } else {
        $('#' + device).addClass('led-off').removeClass('led-on');
    }
}

function convertMsTo(milliseconds, timeUnit) {
    switch (timeUnit) {
        case "sec": return Math.floor((milliseconds % (1000 * 60)) / 1000);
        case "min": return Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        case "hour": return Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    }
}

function countdown(tank) {
    const id = setInterval(frame, 1000);
    let minutes = convertMsTo(tank.timeInMs, 'min');
    let seconds = convertMsTo(tank.timeInMs, 'sec');
    $('#' + tank.idCountdown).text(`${minutes} min : ${seconds} seg`);

    function frame() {

        if (mainProcessActive) {

            if (minutes > 0 && seconds === 0) {
                minutes--;
                seconds = 60;
            }

            seconds--;
            $('#' + tank.idCountdown).text(`${minutes} min : ${seconds} seg`);

            if (minutes <= 0 && seconds <= 0) {
                clearInterval(id);
            }

        } else {
            clearInterval(id);
        }
    }
}

function loader(tank) {

    return new Promise(resolve => {
        const barUnitInMs = tank.timeInMs / 100;
        const id = setInterval(frame, barUnitInMs);
        const literPerUnit = (tank.liters * barUnitInMs) / tank.timeInMs;
        let width = 1;

        function frame() {
            console.log('Drenando...');

            if (mainProcessActive) {

                setDeviceStatus('motorpump', true);

                width++;

                $('#' + tank.idProgressBar)
                    .width(width + '%');

                $('#' + tank.idVolumeControl)
                    .text(` ${Math.round(literPerUnit * width)} lt / ${tank.liters} lt`);

                $('#' + tank.idPercentage)
                    .text(` ${Math.round(width)}%`);

                if (width >= 100) {
                    console.log(`Completado: T${tank.id + 1} | ${tank.liters} lt`);
                    clearInterval(id);
                    resolve();
                }

            } else {
                setDeviceStatus('motorpump', false);
                clearInterval(id);
                resolve();
            }
        }
    });
}