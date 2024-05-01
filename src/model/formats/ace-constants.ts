import { ChecklistItem_Type } from "../../../gen/ts/checklist";
import { FormatError } from "./error";

export namespace AceConstants {
    export const HEADER = Uint8Array.from([0xf0, 0xf0, 0xf0, 0xf0, 0x0, 0x1]);
    export const GROUP_HEADER = Uint8Array.from([0x3c, 0x30]); // '<0'
    export const GROUP_END_HEADER = '>';
    export const CHECKLIST_HEADER = Uint8Array.from([0x28, 0x30]); // '(0'
    export const CHECKLIST_END_HEADER = ')';
    export const FILE_END = "END";
    export const CRLF = Uint8Array.from([0xd, 0xa]);

    export function itemTypeForCode(code: number): ChecklistItem_Type {
        switch (code) {
            case 0x77: // 'w'
                return ChecklistItem_Type.ITEM_WARNING;
            case 0x61: // 'a'
                return ChecklistItem_Type.ITEM_CAUTION;
            case 0x6e: // 'n'
                return ChecklistItem_Type.ITEM_NOTE;
            case 0x70: // 'p'
                return ChecklistItem_Type.ITEM_PLAINTEXT;
            case 0x63: // 'c'
                return ChecklistItem_Type.ITEM_CHALLENGE;
            case 0x72: // 'r'
                return ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE;
            case 0x74: // 't'
                return ChecklistItem_Type.ITEM_TITLE;
            default:
                throw new FormatError('Unexpected checklist item type: 0x' + code.toString(16));
        }
    }

    export function codeForItemType(type: ChecklistItem_Type): number {
        switch (type) {
            case ChecklistItem_Type.ITEM_WARNING:
                return 0x77;  // 'w'
            case ChecklistItem_Type.ITEM_CAUTION:
                return 0x61;  // 'a'
            case ChecklistItem_Type.ITEM_NOTE:
                return 0x6e;  // 'n'
            case ChecklistItem_Type.ITEM_PLAINTEXT:
                return 0x70;  // 'p'
            case ChecklistItem_Type.ITEM_CHALLENGE:
                return 0x63;  // 'c'
            case ChecklistItem_Type.ITEM_CHALLENGE_RESPONSE:
                return 0x72;  // 'r'
            case ChecklistItem_Type.ITEM_TITLE:
                return 0x74;  // 't'
            default:
                throw new FormatError(`Unexpected item type code ${type}`);
        }
    }
}