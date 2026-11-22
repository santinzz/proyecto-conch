import { expect, test } from "vitest";
import { toCsv } from "./csv";

test("CSV con BOM, comillas cuando hace falta y sin fórmulas", () => {
  const csv = toCsv(["a", "b"], [
    ["Jabón, granel", -10],
    ['dijo "hola"', null],
    ["=HYPERLINK(1)", 2.5],
  ]);
  expect(csv).toBe('﻿a,b\r\n"Jabón, granel",-10\r\n"dijo ""hola""",\r\n\'=HYPERLINK(1),2.5\r\n');
});
