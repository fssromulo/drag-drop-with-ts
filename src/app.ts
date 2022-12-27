// Constants project
const DRAGGABLE_ALLOWED_FORMAT = "text/plain";

// Drag & Drop Interfaces
interface Draggable {
	dragStartHandler(event: DragEvent): void;
	dragEndHandler(event: DragEvent): void;
}

interface DragTarget {
	dragOverHandler(event: DragEvent): void;
	dropOverHandler(event: DragEvent): void;
	dragLeaveHandler(event: DragEvent): void;
}

// Project Type
enum ProjectStatus {
	ACTIVE = "active",
	FINISHED = "finished",
}

class Project {
	constructor(
		public id: string, //
		public title: string,
		public description: string,
		public people: number,
		public status: ProjectStatus
	) {}
}

// Project State Management
type Listener<T> = (items: T[]) => void;

class State<T> {
	protected listeners: Listener<T>[] = [];

	addListener(listenerFn: Listener<T>) {
		this.listeners.push(listenerFn);
	}
}

class ProjectState extends State<Project> {
	private projects: Project[] = [];
	private static instance: ProjectState;

	private constructor() {
		super();
	}

	static getInstance() {
		if (!this.instance) {
			this.instance = new ProjectState();
		}
		return this.instance;
	}

	addProject(title: string, description: string, people: number): void {
		const newRandomId = new Date().valueOf().toString();
		const newProject = new Project(newRandomId, title, description, people, ProjectStatus.ACTIVE);
		this.projects.push(newProject);
		this.updateListeners();
	}

	moveProject(projectId: string, newStatus: ProjectStatus): void {
		const project = this.projects.find((prj) => prj.id === projectId);
		if (project && project.status !== newStatus) {
			project.status = newStatus;
			this.updateListeners();
		}
	}

	private updateListeners(): void {
		for (const listenerFn of this.listeners) {
			// "slice" was used here to provide a copy of the original projects list
			listenerFn(this.projects.slice());
		}
	}
}

const projectState = ProjectState.getInstance();

// Validation
interface Validatable {
	value: string | number;
	required?: boolean;
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
}

function validate(validatableInput: Validatable): boolean {
	let isValid = true;

	if (validatableInput.required) {
		isValid = isValid && validatableInput.value.toString().trim().length !== 0;
	}

	if (validatableInput.minLength != null && typeof validatableInput.value === "string") {
		isValid = isValid && validatableInput.value.length >= validatableInput.minLength;
	}

	if (validatableInput.maxLength != null && typeof validatableInput.value === "string") {
		isValid = isValid && validatableInput.value.length <= validatableInput.maxLength;
	}

	if (validatableInput.min != null && typeof validatableInput.value === "number") {
		isValid = isValid && validatableInput.value >= validatableInput.min;
	}

	if (validatableInput.max != null && typeof validatableInput.value === "number") {
		isValid = isValid && validatableInput.value <= validatableInput.max;
	}

	return isValid;
}

// Autobind decorator
function AutoBind(_: any, _2: string, descriptor: PropertyDescriptor) {
	const originalMethod = descriptor.value;
	const adjDescriptor: PropertyDescriptor = {
		configurable: true,
		get() {
			const boundFn = originalMethod.bind(this);
			return boundFn;
		},
	};
	return adjDescriptor;
}

// Component base Class
abstract class Component<T extends HTMLElement, U extends HTMLElement> {
	templateElement: HTMLTemplateElement;
	hostElement: T;
	element: U;

	constructor(templateId: string, hostElementId: string, newElementId?: string, whereToPutTheElement?: InsertPosition) {
		this.templateElement = document.getElementById(templateId)! as HTMLTemplateElement;
		this.hostElement = document.getElementById(hostElementId)! as T;

		const importedNode = document.importNode(this.templateElement.content, true);
		this.element = importedNode.firstElementChild as U;
		if (newElementId) {
			this.element.id = newElementId;
		}

		this.attach(whereToPutTheElement);
	}

	private attach(insertPosition: InsertPosition = "beforeend"): void {
		this.hostElement.insertAdjacentElement(insertPosition, this.element);
	}

	abstract configure(): void;
	abstract renderContent(): void;
}

// ProjectItem Class
class ProjectItem extends Component<HTMLUListElement, HTMLLIElement> implements Draggable {
	private project: Project;

	get persons(): string {
		return this.project.people > 1 ? `${this.project.people} persons` : "1 person";
	}

	constructor(hostId: string, project: Project) {
		super("single-project", hostId, project.id, "beforeend");
		this.project = project;

		this.configure();
		this.renderContent();
	}

	@AutoBind
	dragStartHandler(event: DragEvent): void {
		event.dataTransfer!.setData(DRAGGABLE_ALLOWED_FORMAT, this.project.id);
		event.dataTransfer!.effectAllowed = "move";
	}

	dragEndHandler(_: DragEvent): void {
		console.log("dragEndHandler...");
	}

	configure(): void {
		this.element.addEventListener("dragstart", this.dragStartHandler);
		this.element.addEventListener("dragend", this.dragStartHandler);
	}

	renderContent(): void {
		this.element.querySelector("h2")!.textContent = `Project title: ${this.project.title}`;
		this.element.querySelector("h3")!.textContent = this.persons;
		this.element.querySelector("p")!.textContent = this.project.description;
	}
}

// ProjectList Class
class ProjectList extends Component<HTMLDivElement, HTMLElement> implements DragTarget {
	assignedProjects: Project[] = [];

	constructor(private type: ProjectStatus) {
		super("project-list", "app", `${type.toString()}-projects`, "beforeend");

		this.configure();
		this.renderContent();
	}

	@AutoBind
	dragOverHandler(event: DragEvent): void {
		if (event.dataTransfer && event.dataTransfer.types[0] === DRAGGABLE_ALLOWED_FORMAT) {
			event.preventDefault();
			const listEl = this.element.querySelector("ul")!;
			listEl.classList.add("droppable");
		}
	}

	@AutoBind
	dropOverHandler(event: DragEvent): void {
		const prjId = event.dataTransfer!.getData(DRAGGABLE_ALLOWED_FORMAT);
		projectState.moveProject(prjId, this.type);
	}

	@AutoBind
	dragLeaveHandler(_: DragEvent): void {
		const listEl = this.element.querySelector("ul")!;
		listEl.classList.remove("droppable");
	}

	private renderProjects(): void {
		const listEl = document.getElementById(`${this.type.toString()}-projects-list`)! as HTMLUListElement;

		listEl.innerHTML = "";
		for (const prjItem of this.assignedProjects) {
			new ProjectItem(this.element.querySelector("ul")!.id, prjItem);
		}
	}

	configure(): void {
		this.element.addEventListener("dragover", this.dragOverHandler);
		this.element.addEventListener("drop", this.dropOverHandler);
		this.element.addEventListener("dragleave", this.dragLeaveHandler);

		projectState.addListener((projects: Project[]) => {
			const relevantProjects = projects.filter((prj: Project) => {
				if (this.type === ProjectStatus.ACTIVE) {
					return prj.status === ProjectStatus.ACTIVE;
				}
				return prj.status === ProjectStatus.FINISHED;
			});
			this.assignedProjects = relevantProjects;
			this.renderProjects();
		});
	}

	renderContent(): void {
		const listId = `${this.type.toString()}-projects-list`;
		this.element.querySelector("ul")!.id = listId;
		this.element.querySelector("h2")!.textContent = this.type.toString().toUpperCase() + " Projects";
	}
}

// Project input class
class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
	titleInputElement: HTMLInputElement;
	descriptionInputElement: HTMLInputElement;
	peopleInputElement: HTMLInputElement;

	constructor() {
		super("project-input", "app", "user-input", "afterbegin");

		this.titleInputElement = this.element.querySelector("#title") as HTMLInputElement;
		this.descriptionInputElement = this.element.querySelector("#description") as HTMLInputElement;
		this.peopleInputElement = this.element.querySelector("#people") as HTMLInputElement;

		this.configure();
		this.renderContent();
	}

	@AutoBind
	private submitHandler(event: Event): void {
		event.preventDefault();

		const userInput = this.gatherUserInput();

		if (Array.isArray(userInput)) {
			const [title, description, people] = userInput;
			projectState.addProject(title, description, people);
			this.clearInputs();
		}
	}

	private gatherUserInput(): [string, string, number] | void {
		const enteredTitle = this.titleInputElement.value;
		const enteredDescription = this.descriptionInputElement.value;
		const enteredPeople = this.peopleInputElement.value;

		const titleValidatable: Validatable = {
			value: enteredTitle,
			required: true,
		};

		const descriptionValidatable: Validatable = {
			value: enteredDescription,
			required: true,
			minLength: 5,
		};

		const peopleValidatable: Validatable = {
			value: +enteredPeople,
			required: true,
			min: 1,
			max: 5,
		};

		if (!validate(titleValidatable) || !validate(descriptionValidatable) || !validate(peopleValidatable)) {
			alert("Invalid input, please try again!");
			return;
		} else {
			return [enteredTitle, enteredDescription, +enteredPeople];
		}
	}

	private clearInputs(): void {
		this.titleInputElement.value = "";
		this.descriptionInputElement.value = "";
		this.peopleInputElement.value = "";
	}

	configure(): void {
		this.element.addEventListener("submit", this.submitHandler);
	}

	renderContent(): void {}
}

const prjInput = new ProjectInput();
const activePrjList = new ProjectList(ProjectStatus.ACTIVE);
const finishedPrjList = new ProjectList(ProjectStatus.FINISHED);
