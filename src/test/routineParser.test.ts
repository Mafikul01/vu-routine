import { describe, it, expect, beforeEach } from "vitest";
import { parseUniversityRoutineHtml, sectionToId, idToSection, getStoredSectionRoutine, saveStoredSectionRoutine, getSectionCacheKey } from "@/lib/parser";

const sampleUniversityHtml = `
<table class="table table-bordered table-condensed">
  <thead>
    <tr>
      <th>Day / Time</th>
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
      <td class="slot-cell">
        <div class="event-card" data-id="200212" data-is-consecutive="0">
          <div class="text-bold">CSE 4122</div>
          <div>Technical Report Writing</div>
          <div><i class="fa-user"></i> Tahrima Sayem Sowa, Syeda Tamanna Alam Monisha</div>
          <div>Room 128 BCL</div>
        </div>
      </td>
      <td class="slot-cell">
        <div class="event-card" data-id="200213">
          <div class="text-bold">CSE 4103</div>
          <div>Digital Image Processing</div>
          <div><i class="fa-user"></i> Md. Taufiq Khan</div>
          <div>Room 511</div>
        </div>
      </td>
      <td class="slot-cell"></td>
      <td class="slot-cell">
        <div class="event-card">
          <div class="text-bold">CSE 4101</div>
          <div>Artificial Intelligence</div>
          <div><i class="fa-user"></i> Md. Mahfujur Rahman</div>
          <div>Room 313</div>
        </div>
      </td>
      <td class="slot-cell">
        <div class="event-card">
          <div class="text-bold">CSE 4107</div>
          <div>Microcontroller, Computer Peripherals and Interfacing</div>
          <div><i class="fa-user"></i> Asim Moin Saad</div>
          <div>Room 413</div>
        </div>
      </td>
      <td class="slot-cell"></td>
    </tr>
    <tr>
      <td>Monday</td>
      <td class="slot-cell"></td>
      <td class="slot-cell" colspan="2">
        <div class="event-card" data-is-consecutive="1">
          <div class="text-bold">CSE 4102</div>
          <div>Artificial Intelligence Lab</div>
          <div><i class="fa-user"></i> Md. Mahfujur Rahman, D. M. Asadujjaman</div>
          <div>Room 128 BCL</div>
        </div>
      </td>
      <td class="slot-cell">
        <div class="event-card">
          <div class="text-bold">ACC 4171</div>
          <div>Industrial Management and Accountacy</div>
          <div><i class="fa-user"></i> Saiful Islam</div>
          <div>Room 1008</div>
        </div>
      </td>
      <td class="slot-cell">
        <div class="event-card">
          <div class="text-bold">CSE 4101</div>
          <div>Artificial Intelligence</div>
          <div><i class="fa-user"></i> Md. Mahfujur Rahman</div>
          <div>Room 311</div>
        </div>
      </td>
      <td class="slot-cell"></td>
    </tr>
  </tbody>
</table>
`;

describe("University Routine Parser and Mappings", () => {
  it("correctly maps sections to IDs and back", () => {
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

  it("parses Sunday classes correctly according to Section 9 data", () => {
    const routine = parseUniversityRoutineHtml(sampleUniversityHtml, 7, "B");
    const sundayClasses = routine.filter(c => c.day === "Sunday");

    expect(sundayClasses.length).toBe(4);

    const slot1 = sundayClasses.find(c => c.slot === 1);
    expect(slot1).toBeDefined();
    expect(slot1?.course).toBe("CSE 4122");
    expect(slot1?.room).toBe("128 BCL");
    expect(slot1?.teachers).toContain("Tahrima Sayem Sowa");
    expect(slot1?.teachers).toContain("Syeda Tamanna Alam Monisha");
    expect(slot1?.semester).toBe(7);
    expect(slot1?.section).toBe("B");

    const slot2 = sundayClasses.find(c => c.slot === 2);
    expect(slot2).toBeDefined();
    expect(slot2?.course).toBe("CSE 4103");
    expect(slot2?.room).toBe("511");
    expect(slot2?.teachers).toContain("Md. Taufiq Khan");

    const slot4 = sundayClasses.find(c => c.slot === 4);
    expect(slot4).toBeDefined();
    expect(slot4?.course).toBe("CSE 4101");
    expect(slot4?.room).toBe("313");
    expect(slot4?.teachers).toContain("Md. Mahfujur Rahman");

    const slot5 = sundayClasses.find(c => c.slot === 5);
    expect(slot5).toBeDefined();
    expect(slot5?.course).toBe("CSE 4107");
    expect(slot5?.room).toBe("413");
    expect(slot5?.teachers).toContain("Asim Moin Saad");
  });

  it("handles consecutive slot labs and colspan accurately for Monday", () => {
    const routine = parseUniversityRoutineHtml(sampleUniversityHtml, 7, "B");
    const mondayClasses = routine.filter(c => c.day === "Monday");

    expect(mondayClasses.length).toBe(3);

    const lab = mondayClasses.find(c => c.course === "CSE 4102");
    expect(lab).toBeDefined();
    expect(lab?.slot).toBe(2);
    expect(lab?.room).toBe("128 BCL");
    expect(lab?.teachers).toEqual(["Md. Mahfujur Rahman", "D. M. Asadujjaman"]);

    const acc = mondayClasses.find(c => c.course === "ACC 4171");
    expect(acc).toBeDefined();
    expect(acc?.slot).toBe(4);
    expect(acc?.room).toBe("1008");

    const ai = mondayClasses.find(c => c.course === "CSE 4101" && c.day === "Monday");
    expect(ai).toBeDefined();
    expect(ai?.slot).toBe(5);
    expect(ai?.room).toBe("311");
  });

  it("extracts exact slot times dynamically from table headers without hardcoding", () => {
    const routine = parseUniversityRoutineHtml(sampleUniversityHtml, 7, "B");
    const slot1 = routine.find(c => c.day === "Sunday" && c.slot === 1);
    expect(slot1).toBeDefined();
    expect(slot1?.startTime).toBe("09:00 AM");
    expect(slot1?.endTime).toBe("10:15 AM");
    expect(slot1?.slotTime).toBe("09:00 AM - 10:15 AM");
    expect(slot1?.courseName).toBe("Technical Report Writing");
  });

  it("dynamically spans start and end time across colspan for multi-slot labs", () => {
    const routine = parseUniversityRoutineHtml(sampleUniversityHtml, 7, "B");
    const lab = routine.find(c => c.course === "CSE 4102");
    expect(lab).toBeDefined();
    expect(lab?.slot).toBe(2);
    expect(lab?.colspan).toBe(2);
    expect(lab?.isConsecutive).toBe(true);
    // Slot 2 start is 10:15 AM, Slot 3 end is 12:45 PM
    expect(lab?.startTime).toBe("10:15 AM");
    expect(lab?.endTime).toBe("12:45 PM");
    expect(lab?.slotTime).toBe("10:15 AM - 12:45 PM");
  });

  it("strictly isolates cached routine data per Semester + Section without mixing", () => {
    // Mock localStorage for test environment
    const storage: Record<string, string> = {};
    global.localStorage = {
      getItem: (k: string) => storage[k] || null,
      setItem: (k: string, v: string) => { storage[k] = v; },
      removeItem: (k: string) => { delete storage[k]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
    } as unknown as Storage;

    const sem7SecAClasses = [
      {
        day: "Sunday",
        slot: 1,
        startTime: "09:00 AM",
        endTime: "10:15 AM",
        slotTime: "09:00 AM - 10:15 AM",
        course: "CSE 4101",
        courseName: "Artificial Intelligence",
        teachers: ["Md. Mahfujur Rahman"],
        room: "311",
        semester: 7,
        section: "A"
      }
    ];

    const sem7SecBClasses = [
      {
        day: "Sunday",
        slot: 1,
        startTime: "09:00 AM",
        endTime: "10:15 AM",
        slotTime: "09:00 AM - 10:15 AM",
        course: "CSE 4122",
        courseName: "Technical Report Writing",
        teachers: ["Tahrima Sayem Sowa"],
        room: "128 BCL",
        semester: 7,
        section: "B"
      }
    ];

    saveStoredSectionRoutine(7, "A", sem7SecAClasses);
    saveStoredSectionRoutine(7, "B", sem7SecBClasses);

    // Retrieve Section A
    const retrievedA = getStoredSectionRoutine(7, "A");
    expect(retrievedA).not.toBeNull();
    expect(retrievedA?.length).toBe(1);
    expect(retrievedA?.[0].course).toBe("CSE 4101");
    expect(retrievedA?.[0].section).toBe("A");

    // Retrieve Section B
    const retrievedB = getStoredSectionRoutine(7, "B");
    expect(retrievedB).not.toBeNull();
    expect(retrievedB?.length).toBe(1);
    expect(retrievedB?.[0].course).toBe("CSE 4122");
    expect(retrievedB?.[0].section).toBe("B");

    // Verify they do not bleed into each other
    expect(retrievedA?.[0].course).not.toBe(retrievedB?.[0].course);
    expect(getSectionCacheKey(7, "A")).not.toBe(getSectionCacheKey(7, "B"));
  });

  it("handles various unicode dash and format variations in time strings", () => {
    const htmlWithDashes = `
    <table>
      <thead>
        <tr>
          <th>Day / Time</th>
          <th>Slot 1<br>09:00 AM – 10:15 AM</th>
          <th>Slot 2<br>10:15 AM — 11:30 AM</th>
          <th>Slot 3<br>11:30 AM - 12:45 PM</th>
          <th>Slot 4<br>01:15PM - 02:30PM</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Sunday</td>
          <td>
            <div class="event-card">
              <div class="text-bold">CSE 4101</div>
              <div>Artificial Intelligence</div>
              <div>Md. Mahfujur Rahman</div>
              <div>Room 311</div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    `;
    const routine = parseUniversityRoutineHtml(htmlWithDashes, 7, "A");
    expect(routine.length).toBe(1);
    expect(routine[0].startTime).toBe("09:00 AM");
    expect(routine[0].endTime).toBe("10:15 AM");
    expect(routine[0].slotTime).toBe("09:00 AM - 10:15 AM");
  });

  it("automatically upgrades legacy cache with old 70-minute slot times to exact University times", () => {
    const legacyStorage: Record<string, string> = {};
    global.localStorage = {
      getItem: (k: string) => legacyStorage[k] || null,
      setItem: (k: string, v: string) => { legacyStorage[k] = v; },
      removeItem: (k: string) => { delete legacyStorage[k]; },
      clear: () => { Object.keys(legacyStorage).forEach(k => delete legacyStorage[k]); }
    } as unknown as Storage;

    // Simulate old legacy cache with 10:05 AM
    const oldEntries = [
      {
        day: "Sunday",
        slot: 1,
        startTime: "09:00 AM",
        endTime: "10:05 AM",
        slotTime: "09:00 AM - 10:05 AM",
        course: "CSE 4122",
        teachers: ["Tahrima Sayem Sowa"],
        room: "128 BCL",
        semester: 7,
        section: "B"
      }
    ];

    saveStoredSectionRoutine(7, "B", oldEntries as unknown as Parameters<typeof saveStoredSectionRoutine>[2]);
    const retrieved = getStoredSectionRoutine(7, "B");
    expect(retrieved).not.toBeNull();
    // Must be upgraded to 10:15 AM!
    expect(retrieved?.[0].endTime).toBe("10:15 AM");
    expect(retrieved?.[0].slotTime).toBe("09:00 AM - 10:15 AM");
  });

  it("dynamically parses and tags any Semester and Section accurately without 7-B hardcoding", () => {
    const sem3Html = `
    <table>
      <thead>
        <tr>
          <th>Day / Time</th>
          <th>Slot 1<br>09:00 AM - 10:15 AM</th>
          <th>Slot 2<br>10:15 AM - 11:30 AM</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Tuesday</td>
          <td>
            <div class="event-card">
              <div class="text-bold">CSE 211</div>
              <div>Data Structures</div>
              <div>Dr. Khademul Islam</div>
              <div>Room 405</div>
            </div>
          </td>
          <td>
            <div class="event-card">
              <div class="text-bold">MAT 211</div>
              <div>Linear Algebra</div>
              <div>Prof. Rahman</div>
              <div>Room 302</div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    `;

    // Parse for Semester 3 Section C
    const sem3SecC = parseUniversityRoutineHtml(sem3Html, 3, "C");
    expect(sem3SecC.length).toBe(2);

    expect(sem3SecC[0].semester).toBe(3);
    expect(sem3SecC[0].section).toBe("C");
    expect(sem3SecC[0].course).toBe("CSE 211");
    expect(sem3SecC[0].slotTime).toBe("09:00 AM - 10:15 AM");

    expect(sem3SecC[1].semester).toBe(3);
    expect(sem3SecC[1].section).toBe("C");
    expect(sem3SecC[1].course).toBe("MAT 211");
    expect(sem3SecC[1].slotTime).toBe("10:15 AM - 11:30 AM");

    // Save and verify cache isolation
    saveStoredSectionRoutine(3, "C", sem3SecC);
    const cached3C = getStoredSectionRoutine(3, "C");
    expect(cached3C).toHaveLength(2);
    expect(cached3C?.[0].semester).toBe(3);
    expect(cached3C?.[0].section).toBe("C");

    // Verify it doesn't collide with Semester 3 Section A or Semester 7 Section B
    expect(getStoredSectionRoutine(3, "A")).toBeNull();
  });

  it("accurately parses room numbers in various DOM formats (plain digits, icons, room prefixes)", () => {
    const htmlWithRooms = `
    <table class="table">
      <thead>
        <tr>
          <th>Day</th>
          <th>Slot 1<br>09:00 AM - 10:15 AM</th>
          <th>Slot 2<br>10:15 AM - 11:30 AM</th>
          <th>Slot 3<br>11:30 AM - 12:45 PM</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Sunday</td>
          <td>
            <div class="event-card">
              <div class="text-bold">CSE 4101</div>
              <div>Md. Fatin Ilham</div>
              <div>408</div>
            </div>
          </td>
          <td>
            <div class="event-card">
              <div class="text-bold">CSE 4103</div>
              <div>Zuairia Raisa Bintay Makin</div>
              <div><i class="fa fa-map-marker"></i> 412</div>
            </div>
          </td>
          <td>
            <div class="event-card">
              <div class="text-bold">ACC 4171</div>
              <div>Fahmida Akter Jesis Shithi</div>
              <div>Room: 509</div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    `;

    const parsed = parseUniversityRoutineHtml(htmlWithRooms, 7, "C");
    expect(parsed).toHaveLength(3);
    expect(parsed[0].room).toBe("408");
    expect(parsed[1].room).toBe("412");
    expect(parsed[2].room).toBe("509");
  });
});
