import { GLib, GObject, property, readFile, register, writeFileAsync } from "astal";
import { derivative, evaluate, rationalize, simplify } from "mathjs/number";
import { CACHE_DIR } from "../utils/constants";

export interface HistoryItem {
    equation: string;
    result: string;
    icon: string;
}

@register({ GTypeName: "Math" })
export default class Math extends GObject.Object {
    static instance: Math;
    static get_default() {
        if (!this.instance) this.instance = new Math();

        return this.instance;
    }

    readonly #maxHistory = 20;
    readonly #path = `${CACHE_DIR}/math-history.json`;
    readonly #history: HistoryItem[] = [];

    #variables: Record<string, string> = {};
    #lastExpression: HistoryItem | null = null;

    @property(Object)
    get history() {
        return this.#history;
    }

    #save() {
        writeFileAsync(this.#path, JSON.stringify(this.#history)).catch(console.error);
    }

    /**
     * Commits the last evaluated expression to the history
     */
    commit() {
        if (!this.#lastExpression) return;

        // Try select first to prevent duplicates, if it fails, add it
        if (!this.select(this.#lastExpression)) {
            this.#history.unshift(this.#lastExpression);
            if (this.#history.length > this.#maxHistory) this.#history.pop();
            this.notify("history");
            this.#save();
        }
        this.#lastExpression = null;
    }

    /**
     * Moves an item in the history to the top
     * @param item The item to select
     * @returns If the item was successfully selected
     */
    select(item: HistoryItem) {
        const idx = this.#history.findIndex(i => i.equation === item.equation && i.result === item.result);
        if (idx >= 0) {
            this.#history.splice(idx, 1);
            this.#history.unshift(item);
            this.notify("history");
            this.#save();

            return true;
        }

        return false;
    }

    /**
     * Clears the history and variables
     */
    clear() {
        if (this.#history.length > 0) {
            this.#history.length = 0;
            this.notify("history");
            this.#save();
        }
        this.#lastExpression = null;
        this.#variables = {};
    }

    /**
     * Evaluates an equation and adds it to the history
     * @param equation The equation to evaluate
     * @returns A {@link HistoryItem} representing the result of the equation
     */
    evaluate(equation: string): HistoryItem {
        if (equation.startsWith("clear"))
            return {
                equation: "Clear history",
                result: "Delete history and previously set variables",
                icon: "delete_forever",
            };

        let result: string, icon: string;
        try {
            if (equation.includes("=")) {
                const [left, right] = equation.split("=");
                try {
                    this.#variables[left.trim()] = simplify(right).toString();
                } catch {
                    this.#variables[left.trim()] = right.trim();
                }
                result = this.#variables[left.trim()];
                icon = "equal";
            } else if (equation.startsWith("simplify")) {
                result = simplify(equation.slice(8), this.#variables).toString();
                icon = "function";
            } else if (equation.startsWith("derive")) {
                const respectTo = equation.split(" ")[1];
                if (!respectTo) throw new Error("Format: derive <respect-to> <equation>");
                result = derivative(equation.slice(7 + respectTo.length), respectTo).toString();
                icon = "function";
            } else if (equation.startsWith("rationalize")) {
                result = rationalize(equation.slice(11), this.#variables).toString();
                icon = "function";
            } else {
                result = evaluate(equation, this.#variables).toString();
                icon = "calculate";
            }
        } catch (e) {
            equation = "Invalid equation";
            result = String(e);
            icon = "error";
        }

        return (this.#lastExpression = { equation, result, icon });
    }

    constructor() {
        super();

        // Load history
        if (GLib.file_test(this.#path, GLib.FileTest.EXISTS)) {
            try {
                this.#history = JSON.parse(readFile(this.#path));
                // Init eval to create variables and last expression
                for (const item of this.#history) this.evaluate(item.equation);
            } catch (e) {
                console.error("Math - Unable to load history", e);
            }
        }
    }
}