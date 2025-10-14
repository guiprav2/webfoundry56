export default class Playground {
  state = {
    nameInput: '',
    greeting: 'Hello, Webfoundry Explorer!',
    tasks: [
      {
        id: 'task-tailwind',
        label: 'Experiment with Tailwind text colors on the hero headline.',
        done: false,
      },
      {
        id: 'task-fonts',
        label: 'Apply a gfont-[Inter] class and adjust font-weight utilities.',
        done: false,
      },
      {
        id: 'task-spacing',
        label: 'Tweak padding and gap classes in the Styles panel for the instruction cards.',
        done: false,
      },
    ],
    newTask: '',
  };

  actions = {
    updateName: value => {
      this.state.nameInput = value;
    },

    fireGreeting: () => {
      let name = this.state.nameInput.trim();
      this.state.greeting = `Hello, ${name || 'Webfoundry Explorer'}!`;
    },

    toggleTask: id => {
      let task = this.state.tasks.find(x => x.id === id);
      if (!task) return;
      task.done = !task.done;
    },

    addTask: () => {
      let label = this.state.newTask?.trim();
      if (!label) return;
      this.state.tasks = [
        { id: crypto.randomUUID(), label, done: false },
        ...this.state.tasks,
      ];
      this.state.newTask = '';
    },

    clearCompleted: () => {
      this.state.tasks = this.state.tasks.filter(x => !x.done);
    },
  };
}
