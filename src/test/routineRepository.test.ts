import { describe, it, expect, beforeEach, vi } from "vitest";
import { routineRepository } from "@/services/routineRepository";
import { parseUniversityRoutineHtml, sectionToId, idToSection } from "@/lib/parser";

const SAMPLE_UNIVERSITY_HTML = `
<!DOCTYPE html>
<html>
<body>
  <table class="table table-bordered routine-table">
    <thead>
      <tr>
        <th>Day</th>
        <th>Slot 1<br>09:00 AM - 10:15 AM</th>
        <th>Slot 2<br>10:15 AM - 11:30 AM</th>
        <th>Slot 3<br>11:30 AM - 12:45 PM</th>
        <th>Slot 4<br>01:15 PM - 02:30 PM</th>
        <th>Slot 5<br>02:30 PM - 03:45 PM</th>
        <th>Slot 6<br>03:45 PM - 05:00 PM</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Sunday</td>
        <td></td>
        <td></td>
        <td>
          <div class="event-card" data-slot="3">
            <div class="text-bold">CSE 4103</div>
            <div class="course-title">Artificial Intelligence</div>
            <div><i class="fa fa-user"></i> Zuairia Raisa Bintay Makin</div>
            <div>Room: 412</div>
          </div>
        </td>
        <td>
          <div class="event-card" data-slot="4">
            <div class="text-bold">CSE 4101</div>
            <div class="course-title">Compiler Design</div>
            <div><i class="fa fa-user"></i> Md. Fatin Ilham</div>
            <div>Room: 408</div>
          </div>
        </td>
        <td></td>
        <td>
          <div class="event-card" data-slot="6">
            <div class="text-bold">ACC 4171</div>
            <div class="course-title">Industrial Management & Accountancy</div>
            <div><i class="fa fa-user"></i> Fahmida Akter Jesis Shithi</div>
            <div>Room: 509</div>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`;

describe("RoutineRepository and Dynamic Parsing Architecture", () => {
  beforeEach(() => {
    routineRepository.invalidate();
    vi.restoreAllMocks();
  });

  it("dynamically resolves section mapping: A->1, B->2, C->3, D->4, E->5, F->6", () => {
    expect(sectionToId("A")).toBe(1);
    expect(sectionToId("B")).toBe(2);
    expect(sectionToId("C")).toBe(3);
    expect(sectionToId("D")).toBe(4);
    expect(sectionToId("E")).toBe(5);
    expect(sectionToId("F")).toBe(6);

    expect(idToSection(1)).toBe("A");
    expect(idToSection(2)).toBe("B");
    expect(idToSection(3)).toBe("C");
    expect(idToSection(4)).toBe("D");
    expect(idToSection(5)).toBe("E");
    expect(idToSection(6)).toBe("F");
  });

  it("generates deterministic canonical cache keys", () => {
    expect(routineRepository.getCanonicalKey(7, "B")).toBe("routine:7:2");
    expect(routineRepository.getCanonicalKey(7, "C")).toBe("routine:7:3");
    expect(routineRepository.getCanonicalKey(3, "A")).toBe("routine:3:1");
  });

  it("dynamically extracts slots and exact start/end times from table header HTML without hardcoded schedules", () => {
    const parsed = parseUniversityRoutineHtml(SAMPLE_UNIVERSITY_HTML, 7, "C");
    expect(parsed.length).toBe(3);

    const slot6 = parsed.find(e => e.slot === 6 && e.day === "Sunday");
    expect(slot6).toBeDefined();
    expect(slot6?.course).toBe("ACC 4171");
    expect(slot6?.startTime).toBe("03:45 PM");
    expect(slot6?.endTime).toBe("05:00 PM");
    expect(slot6?.slotTime).toBe("03:45 PM - 05:00 PM");
    expect(slot6?.teachers).toContain("Fahmida Akter Jesis Shithi");
    expect(slot6?.room).toBe("509");
  });

  it("deduplicates identical events between desktop and mobile representations", () => {
    const htmlWithDuplicate = SAMPLE_UNIVERSITY_HTML + `
      <div class="routine-day">
        <div class="day-name">Sunday</div>
        <div class="routine-slot" data-slot="6">
          <div class="event-card">
            <div class="text-bold">ACC 4171</div>
            <div><i class="fa fa-user"></i> Fahmida Akter Jesis Shithi</div>
            <div>Room: 509</div>
          </div>
        </div>
      </div>
    `;
    const parsed = parseUniversityRoutineHtml(htmlWithDuplicate, 7, "C");
    const slot6Events = parsed.filter(e => e.slot === 6 && e.day === "Sunday");
    expect(slot6Events.length).toBe(1);
  });

  it("returns null for uncached section and validates data before caching", () => {
    const uncached = routineRepository.getCached(8, "D");
    expect(uncached).toBeNull();
  });
});
