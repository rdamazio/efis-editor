import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { firstValueFrom, timer } from 'rxjs';
import { ChecklistFile } from '../../../../gen/ts/checklist';
import { DYNON_EXPECTED_CONTENTS } from '../../../model/formats/dynon-format.spec';
import { GRT_EXPECTED_CONTENTS } from '../../../model/formats/grt-format.spec';
import {
  EXPECTED_CONTENTS,
  EXPECTED_CONTENTS_WITH_COMPLETION_ACTION,
  EXPECTED_FOREFLIGHT_CONTENTS,
} from '../../../model/formats/test-data';
import { loadFile } from '../../../model/formats/test-utils';
import { ChecklistFileUploadComponent } from './file-upload.component';

describe('ChecklistFileUploadComponent', () => {
  let user: UserEvent;
  let fileUploaded: jasmine.Spy;
  let uploadInput: HTMLInputElement;

  beforeEach(async () => {
    user = userEvent.setup();
    fileUploaded = jasmine.createSpy('fileUploaded');

    await render(ChecklistFileUploadComponent, {
      imports: [NoopAnimationsModule],
      on: { fileUploaded },
    });
    // The input is hidden and has no text, so we must fetch it directly from the document.
    // eslint-disable-next-line testing-library/no-node-access
    uploadInput = document.querySelector('input[type="file"]')!;
  });

  async function forUpload() {
    // NgxFileDrop queues files and uploads them every 200ms.
    return firstValueFrom(timer(300), { defaultValue: null });
  }

  it('should render', () => {
    expect(uploadInput).toBeInTheDocument();
    expect(screen.getByText(/Drop files here/)).toBeVisible();
  });

  async function expectUpload(fileName: string, expectedContents: ChecklistFile) {
    const f = await loadFile(`/model/formats/${fileName}`, fileName);
    await user.upload(uploadInput, f);

    await forUpload();

    expect(fileUploaded).toHaveBeenCalledOnceWith(expectedContents);
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
