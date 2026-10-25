"""Phone-size click-through of every route.

Usage: npm run build && (cd dist && python3 -m http.server 4173) &
       python3 tests/e2e/smoke.py http://localhost:4173/index.html [screenshot_dir]
Requires: pip install playwright && python -m playwright install chromium
"""
import json, os, sys, re, tempfile
from playwright.sync_api import sync_playwright, expect

URL = sys.argv[1]
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), 'app-shots')
WORK = tempfile.mkdtemp()
IMG = os.path.join(WORK, 'pet.jpg')
DL = os.path.join(WORK, 'dl')
os.makedirs(DL, exist_ok=True)
os.makedirs(SHOTS, exist_ok=True)
try:
    from PIL import Image
    Image.new('RGB', (800, 600), (200, 150, 90)).save(IMG)
except ImportError:  # 1x1 JPEG fallback
    import base64
    open(IMG, 'wb').write(base64.b64decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='))
errors = []

def shot(page, name, full=False):
    page.evaluate('window.scrollTo(0,0)')
    try:
        page.locator('.toast').wait_for(state='detached', timeout=4000)
    except Exception:
        pass
    page.wait_for_timeout(150)
    page.screenshot(path=f'{SHOTS}/{name}.png', full_page=full)

def log_console(msg):
    if msg.type in ('error', 'warning'):
        errors.append(f'{msg.type}: {msg.text}')

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
    page = ctx.new_page()
    page.on('console', log_console)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.goto(URL)

    # onboarding
    page.get_by_label('Household name').fill('The Testers')
    page.get_by_role('button', name='Continue').click()
    page.get_by_label('Pet name').fill('Pepper')
    page.get_by_role('radio', name='Cat').click()
    page.get_by_role('button', name='Get started').click()
    expect(page.get_by_text('The Testers')).to_be_visible()

    # load sample pets
    page.goto(URL + '#/pets')
    page.goto(URL + '#/')
    page.get_by_role('link', name=re.compile('Pepper')).first.wait_for()
    # sample pets via account
    page.goto(URL + '#/account')
    page.get_by_role('button', name='Load sample pets').click()
    page.goto(URL + '#/')
    expect(page.get_by_text('Showing sample pets')).to_be_visible()
    shot(page, 'home', False)

    # add a pet with photo
    page.goto(URL + '#/pets')
    page.get_by_role('button', name='Add pet').click()
    page.locator('input[type=file]').set_input_files(IMG)
    page.get_by_alt_text('Selected preview').wait_for()
    page.get_by_label('Name', exact=True).fill('Mochi')
    page.get_by_role('radio', name='Dog').click()
    page.get_by_label('Breed').fill('Shiba Inu')
    page.get_by_label('Birth date').fill('2023-03-15')
    page.get_by_label('Weight', exact=True).fill('22')
    page.get_by_label('Allergies').fill('beef, dairy')
    page.get_by_label('Microchip number').fill('985112003456789')
    page.get_by_role('button', name='Save pet').click()
    page.wait_for_url(re.compile(r'#/pets/pet-'))
    expect(page.get_by_role('heading', name='Mochi')).to_be_visible()
    mochi_url = page.url

    # add vaccine
    page.get_by_role('button', name='Vaccine').click()
    page.get_by_label('Vaccine').fill('Rabies')
    page.get_by_label('Date given or done').fill('2025-11-01')
    page.get_by_label('Next due date').fill('2026-11-01')
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_role('heading', name='Due soon')).to_be_visible()
    # add weight
    page.get_by_role('button', name='Weight', exact=True).click()
    page.get_by_label('Weight (lb)').fill('23.5')
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.locator('figure.chart svg')).to_be_visible()
    # journal note
    page.get_by_role('button', name='Journal note').click()
    page.get_by_label('Title').fill('First hike')
    page.get_by_role('button', name='Save', exact=True).click()
    # mark vaccine done flow is on sample pet; take pet detail shot on Bailey
    page.goto(URL + '#/pets/sample-pet-bailey')
    page.get_by_role('heading', name='Bailey').wait_for()
    shot(page, 'pet-detail', False)
    shot(page, 'pet-detail-full', True)
    page.get_by_role('button', name=re.compile('Mark Heartworm preventive done')).click()
    # profile + docs tabs
    page.get_by_role('tab', name='Profile').click()
    page.get_by_role('tab', name=re.compile('Documents')).click()
    page.get_by_role('button', name='Add', exact=True).click()
    page.get_by_label('Name').fill('Rabies certificate')
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_text('Rabies certificate')).to_be_visible()

    # explore: add & save a place
    page.goto(URL + '#/explore')
    page.get_by_role('group', name='Filter by category').get_by_role('button', name='Hotel').click()
    expect(page.get_by_text('Paws and Stay Hotel')).to_be_visible()
    page.get_by_role('group', name='Filter by category').get_by_role('button', name='All', exact=True).click()
    page.get_by_role('button', name='Add place').click()
    page.get_by_label('Name').fill('Oak Hollow Off-Leash Park')
    page.get_by_role('button', name='Choose').click()
    page.get_by_role('option', name='Dog park').click()
    page.get_by_label('City').fill('Testville')
    page.get_by_role('radiogroup', name='Dogs allowed').get_by_role('radio', name='Yes', exact=True).click()
    page.get_by_role('radiogroup', name='Cats allowed').get_by_role('radio', name='No', exact=True).click()
    page.get_by_role('radio', name='Off-leash area').click()
    page.get_by_role('button', name='Save place').click()
    page.wait_for_url(re.compile(r'#/explore/place-'))
    expect(page.get_by_text('Unverified, call ahead')).to_be_visible()
    page.get_by_role('button', name='Save place').click()
    page.get_by_role('button', name='I confirmed this policy today').click()
    expect(page.get_by_text(re.compile('Verified on .* by you'))).to_be_visible()
    page.get_by_role('radio', name='4 stars').click()
    page.get_by_label('Notes').fill('Bring a towel, muddy after rain')
    page.get_by_role('button', name='Save notes').click()
    page.goto(URL + '#/explore')
    page.get_by_role('button', name='Save Paws and Stay Hotel').click()
    page.get_by_label('Search places').fill('oak')
    expect(page.get_by_text('Oak Hollow Off-Leash Park')).to_be_visible()
    page.get_by_label('Search places').fill('')
    shot(page, 'explore', False)

    # travel
    page.goto(URL + '#/travel')
    page.get_by_role('button', name='New trip').click()
    page.get_by_label('Trip name').fill('Lake weekend')
    page.get_by_label('Destination').fill('Lakeview')
    page.get_by_label('Start date').fill('2026-10-30')
    page.get_by_label('End date').fill('2026-11-01')
    page.get_by_role('button', name='Create trip').click()
    page.wait_for_url(re.compile(r'#/travel/trip-'))
    page.get_by_role('button', name='Add stop').click()
    page.get_by_role('button', name='Choose a place').click()
    page.get_by_role('option', name=re.compile('Paws and Stay Hotel')).click()
    page.get_by_label('Time', exact=True).fill('15:00')
    page.get_by_role('button', name='Save stop').click()
    page.get_by_role('button', name='Add stop').click()
    page.get_by_role('tab', name='Free text').click()
    page.get_by_label('Stop', exact=True).fill('Rest area with grass')
    page.get_by_label('Day', exact=True).fill('2026-10-31')
    page.get_by_label('Time', exact=True).fill('10:30')
    page.get_by_role('button', name='Save stop').click()
    expect(page.get_by_text('Rest area with grass')).to_be_visible()
    expect(page.get_by_text(re.compile('Bring vaccine records'))).to_be_visible()
    expect(page.get_by_text('Litter, litter box and scoop for Luna')).to_be_visible()
    page.get_by_text('Leash and harness for Bailey').click()
    page.get_by_text('Vaccine records for Luna').click()
    page.get_by_label('Add packing item').fill('Lake towel')
    page.get_by_role('button', name='Add item').click()
    expect(page.get_by_text('2 of')).to_be_visible()
    trip_url = page.url
    shot(page, 'trip', False)
    shot(page, 'trip-full', True)

    # events
    page.goto(URL + '#/events')
    page.get_by_role('button', name='New event').click()
    page.get_by_label('Title').fill("Luna's birthday")
    page.get_by_role('radio', name='Pet birthday').click()
    page.get_by_label('Date', exact=True).fill('2026-10-28')
    page.get_by_label('Time', exact=True).fill('17:00')
    page.get_by_role('button', name='Save event').click()
    expect(page.get_by_role('heading', name="Luna's birthday")).to_be_visible()
    page.get_by_role('group', name='RSVP for Saturday Walk Club').get_by_role('button', name='Going', exact=True).click()

    # community
    page.goto(URL + '#/community')
    page.get_by_role('button', name='New post').click()
    page.locator('input[type=file]').set_input_files(IMG)
    page.get_by_alt_text('Selected preview').wait_for()
    page.get_by_label('Caption').fill('Nap time')
    page.get_by_role('button', name='Post', exact=True).click()
    expect(page.get_by_text('Nap time')).to_be_visible()

    # box builder
    page.goto(URL + '#/boxes/build')
    page.get_by_role('radiogroup', name='Pet').get_by_role('radio', name='Bailey').click()
    expect(page.get_by_text('No chicken')).to_be_visible()
    page.get_by_role('radio', name=re.compile('Busy Body')).click()
    page.get_by_role('radio', name='Quarterly').click()
    page.get_by_role('switch', name=re.compile('Toys only')).click()
    page.get_by_label('Add a restriction').fill('squeakers')
    page.get_by_role('button', name='Add', exact=True).click()
    expect(page.get_by_text('No squeakers')).to_be_visible()
    shot(page, 'box-builder', False)
    shot(page, 'box-builder-full', True)
    assert page.get_by_role('button', name='Checkout').first.is_disabled()
    page.get_by_role('button', name='Save box plan').click()
    page.wait_for_url(re.compile(r'#/boxes$'))
    expect(page.get_by_text('Coming soon.').first).to_be_visible()

    # other routes
    for r in ['#/care', '#/shop', '#/more', '#/notifications', '#/account', '#/explore/sample-place-riverside', '#/nope', '#/pets/missing', '#/travel/missing', '#/explore/missing']:
        page.goto(URL + r)
        page.wait_for_timeout(150)
        page.screenshot(path=f'{SHOTS}/route-{r.strip("#/").replace("/", "_") or "home"}.png')
    page.goto(URL + '#/notifications')
    expect(page.get_by_text(re.compile('Lake weekend starts'))).to_be_visible()
    page.goto(URL + '#/shop')
    expect(page.locator('a[href="https://healthextension.com"]')).to_be_visible()

    # export
    page.goto(URL + '#/account')
    with page.expect_download() as d:
        page.get_by_role('button', name='Export all data (JSON)').click()
    path = os.path.join(DL, 'export.json'); d.value.save_as(path)
    data = json.load(open(path))
    assert len(data['pets']) == 4, len(data['pets'])
    assert len(data['trips']) == 1 and len(data['trips'][0]['stops']) == 2
    with page.expect_download() as d:
        page.get_by_role('button', name='Export care records (CSV)').click()
    d.value.save_as(os.path.join(DL, 'care.csv'))

    # reload persistence
    page.reload()
    page.goto(URL + '#/pets')
    for n in ['Pepper', 'Mochi', 'Bailey', 'Luna']:
        expect(page.get_by_role('link', name=re.compile(n)).first).to_be_visible()
    page.goto(mochi_url); page.reload()
    expect(page.get_by_text('Rabies', exact=True).first).to_be_visible()
    page.goto(trip_url); page.reload()
    expect(page.get_by_text('Lake towel')).to_be_visible()
    assert page.locator('.check.done').count() == 2
    page.goto(URL + '#/boxes'); page.reload()
    expect(page.get_by_role('heading', name='Busy Body')).to_be_visible()

    # delete all then import
    page.goto(URL + '#/account')
    page.get_by_role('button', name='Delete everything').first.click()
    page.get_by_role('dialog').get_by_role('button', name='Delete everything').click()
    expect(page.get_by_label('Household name')).to_be_visible()
    page.get_by_label('Household name').fill('Temp')
    page.get_by_role('button', name='Continue').click()
    page.get_by_role('button', name='Skip for now').click()
    page.goto(URL + '#/account')
    page.locator('input[type=file]').set_input_files(path)
    page.get_by_role('dialog').get_by_role('button', name='Import').click()
    page.goto(URL + '#/pets')
    expect(page.get_by_text('Mochi', exact=True)).to_be_visible()

    # 360 width check: no horizontal scroll
    page.set_viewport_size({'width': 360, 'height': 780})
    for r in ['#/', '#/explore', '#/pets/sample-pet-bailey', trip_url.split('#')[1] and '#' + trip_url.split('#')[1], '#/boxes/build', '#/events', '#/account']:
        page.goto(URL + r); page.wait_for_timeout(120)
        sw = page.evaluate('document.documentElement.scrollWidth')
        if sw > 360: errors.append(f'horizontal overflow {sw}px on {r}')
    # tap targets in tabbar
    sizes = page.evaluate("[...document.querySelectorAll('.tab')].map(e=>e.getBoundingClientRect().height)")
    assert all(s >= 44 for s in sizes), sizes

    # dark mode shot
    dctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, color_scheme='dark')
    dp = dctx.new_page(); dp.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    dp.goto(URL)
    dp.get_by_label('Household name').fill('Dark'); dp.get_by_role('button', name='Continue').click()
    dp.get_by_label('Pet name').fill('Shadow'); dp.get_by_role('button', name='Get started').click()
    dp.goto(URL + '#/account'); dp.get_by_role('button', name='Load sample pets').click()
    dp.goto(URL + '#/'); dp.wait_for_timeout(200)
    dp.screenshot(path=f'{SHOTS}/home-dark.png')
    # desktop shot
    page.set_viewport_size({'width': 1280, 'height': 860})
    page.goto(URL + '#/'); page.wait_for_timeout(200)
    page.screenshot(path=f'{SHOTS}/desktop-home.png')
    b.close()

ignore = ('fonts.googleapis', 'fonts.gstatic', 'ERR_TUNNEL', 'ERR_CONNECTION', 'net::', 'Failed to load resource')
real = [e for e in errors if not any(i in e for i in ignore)]
print('ALL CONSOLE:', *errors, sep='\n  ')
print('REAL ERRORS:', real)
print('OK' if not real else 'FAIL')
