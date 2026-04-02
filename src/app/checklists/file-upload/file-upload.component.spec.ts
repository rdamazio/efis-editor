import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { asyncScheduler, firstValueFrom, timer } from 'rxjs';
import type { Mock } from 'vitest';
import { ChecklistFile } from '../../../../gen/ts/checklist';
import {
  DYNON_EXPECTED_CONTENTS,
  EXPECTED_CONTENTS,
  EXPECTED_CONTENTS_WITH_COMPLETION_ACTION,
  EXPECTED_FOREFLIGHT_CONTENTS,
  GRT_EXPECTED_CONTENTS,
} from '../../../model/formats/test-data';
import { loadFile } from '../../../model/formats/test-utils';
import { ChecklistFileUploadComponent } from './file-upload.component';

describe('ChecklistFileUploadComponent', () => {
  let fileUploaded: Mock<(value: ChecklistFile) => undefined>;
  let uploadInput: HTMLInputElement;
  let user: UserEvent;

  beforeEach(async () => {
    // Intercept RxJS asyncScheduler to arbitrarily fast-forward ngx-file-drop's internal 200ms queue loops
    const originalSchedule = asyncScheduler.schedule.bind(asyncScheduler);
    vi.spyOn(asyncScheduler, 'schedule').mockImplementation((work, delay, state) =>
      originalSchedule(work, delay === 200 ? 5 : delay, state),
    );

    user = userEvent.setup();
    fileUploaded = vi.fn().mockName('ChecklistFileUploadComponent.fileUploaded');

    await render(ChecklistFileUploadComponent, { on: { fileUploaded } });

    // The input is hidden and has no text, so we must fetch it directly from the document.
    // eslint-disable-next-line testing-library/no-node-access
    uploadInput = document.querySelector('input[type="file"]')!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function forUpload() {
    // NgxFileDrop normally queues files and uploads them every 200ms.
    // We arbitrarily intercept this payload queue dynamically.
    return firstValueFrom(timer(20), { defaultValue: null });
  }

  it('should render', () => {
    expect(uploadInput).toBeInTheDocument();
    expect(screen.getByText(/Drop files here/)).toBeVisible();
  });

  async function expectUpload(fileName: string, expectedContents: ChecklistFile) {
    const f = await loadFile(`/src/model/formats/${fileName}`, fileName);

    await user.upload(uploadInput, f);
    await forUpload();

    expect(fileUploaded).toHaveBeenCalledExactlyOnceWith(expectedContents);
  }

  it('should upload JSON file', async () => {
    await expectUpload('test.json', EXPECTED_CONTENTS_WITH_COMPLETION_ACTION);
  });

  it('should upload ACE file', async () => {
    await expectUpload('test.ace', EXPECTED_CONTENTS);
  });

  it('should upload Dynon file', async () => {
    await expectUpload('test-dynon.txt', DYNON_EXPECTED_CONTENTS);
  });

  it('should upload GRT file', async () => {
    await expectUpload('test-grt.txt', GRT_EXPECTED_CONTENTS);
  });

  it('should upload Foreflight file', async () => {
    await expectUpload('test-foreflight.fmd', EXPECTED_FOREFLIGHT_CONTENTS);
  });

  it('should handle an invalid file', async () => {
    const badFile = new File(['bad file contents'], 'file.bad');

    await user.upload(uploadInput, badFile);
    await forUpload();

    expect(fileUploaded).not.toHaveBeenCalled();
  });
});
