import readline from 'readline';

export default function getpass(promptText) {
  return new Promise(pres => {
    let rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    let inputBuffer = [];
    let cursor = 0;

    process.stdout.write(promptText);
    readline.emitKeypressEvents(process.stdin, rl);
    process.stdin.setRawMode(true);

    function redraw() {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(promptText + '*'.repeat(inputBuffer.length));
      process.stdout.cursorTo(promptText.length + cursor);
    }

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.removeListener('keypress', onKeypress);
      rl.close();
    }

    function onKeypress(char, key) {
      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        pres(inputBuffer.join(''));
      } else if (key.ctrl && key.name === 'c') {
        cleanup();
        process.stdout.write('^C\n');
        process.exit(1);
      } else if (key.ctrl && key.name === 'u') {
        inputBuffer.length = 0;
        cursor = 0;
        redraw();
      } else if (key.name === 'backspace') {
        if (cursor > 0) {
          inputBuffer.splice(cursor - 1, 1);
          cursor--;
          redraw();
        }
      } else if (key.name === 'left') {
        if (cursor > 0) {
          cursor--;
          redraw();
        }
      } else if (key.name === 'right') {
        if (cursor < inputBuffer.length) {
          cursor++;
          redraw();
        }
      } else if (char && !key.ctrl && !key.meta) {
        inputBuffer.splice(cursor, 0, char);
        cursor++;
        redraw();
      }
    }

    process.stdin.on('keypress', onKeypress);
  });
};
