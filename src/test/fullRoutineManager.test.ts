import { describe, it, expect } from "vitest";
import { fullDepartmentRoutine } from "@/data/fullDepartmentRoutine";
import {
  getDepartmentAllRooms,
  getDepartmentClassesByRoom,
  getDepartmentClassesBySlot,
  getRoomOccupancyMap,
  getDepartmentAllTeachers,
  getDepartmentClassesForTeacher,
  getDepartmentRoomFreeDays
} from "@/lib/fullRoutineManager";

describe("Full Department Routine & Room Finder Analysis", () => {
  it("should have comprehensive full department routine with > 500 entries across 8 semesters", () => {
    expect(fullDepartmentRoutine.length).toBeGreaterThan(500);

    const semestersPresent = new Set(fullDepartmentRoutine.map(e => e.semester));
    expect(semestersPresent.has(1)).toBe(true);
    expect(semestersPresent.has(2)).toBe(true);
    expect(semestersPresent.has(3)).toBe(true);
    expect(semestersPresent.has(7)).toBe(true);
    expect(semestersPresent.has(8)).toBe(true);
  });

  it("should discover all unique department rooms and sort them naturally", () => {
    const rooms = getDepartmentAllRooms(fullDepartmentRoutine);
    expect(rooms.length).toBeGreaterThanOrEqual(35);
    expect(rooms).toContain("1001");
    expect(rooms).toContain("128 BCL");
    expect(rooms).not.toContain("TBA");
  });

  it("should accurately identify classes across different semesters occupying the same room on a given day", () => {
    // Room 1001 is used across multiple semesters
    const classesIn1001 = getDepartmentClassesByRoom(fullDepartmentRoutine, "Sunday", "1001");
    expect(Array.isArray(classesIn1001)).toBe(true);
    for (const c of classesIn1001) {
      expect(c.day.toLowerCase()).toBe("sunday");
      expect(c.room).toBe("1001");
    }
  });

  it("should accurately compute room occupancy for a slot across all semesters and sections", () => {
    const sundaySlot1Classes = getDepartmentClassesBySlot(fullDepartmentRoutine, "Sunday", 1);
    expect(sundaySlot1Classes.length).toBeGreaterThan(0);

    const occupancyMap = getRoomOccupancyMap(fullDepartmentRoutine, "Sunday", 1);
    expect(occupancyMap.size).toBeGreaterThan(0);

    // Verify each entry in occupancyMap corresponds to Sunday Slot 1
    for (const [room, classEntry] of occupancyMap.entries()) {
      expect(classEntry.day).toBe("Sunday");
      expect(classEntry.slot).toBe(1);
      expect(classEntry.room).toBe(room);
    }
  });

  it("should aggregate teacher schedules across all semesters and sections", () => {
    const allTeachers = getDepartmentAllTeachers(fullDepartmentRoutine);
    expect(allTeachers.length).toBeGreaterThan(50);

    // Pick a teacher from the dataset
    const sampleTeacher = allTeachers[0];
    const teacherClasses = getDepartmentClassesForTeacher(fullDepartmentRoutine, sampleTeacher);
    expect(teacherClasses.length).toBeGreaterThan(0);

    // All returned classes must contain the teacher
    for (const c of teacherClasses) {
      expect(c.teachers.some(t => t.toLowerCase().includes(sampleTeacher.toLowerCase()))).toBe(true);
    }
  });

  it("should calculate free days for a room", () => {
    const rooms = getDepartmentAllRooms(fullDepartmentRoutine);
    const freeDays = getDepartmentRoomFreeDays(fullDepartmentRoutine, rooms[0]);
    expect(Array.isArray(freeDays)).toBe(true);
    // Friday and Saturday usually have no classes
    expect(freeDays).toContain("Friday");
  });
});
