"""Phone-size click-through of every route.

Usage: npm run build && npm run build:demo
       python3 tests/e2e/smoke.py [URL|-] [screenshot_dir] [demo_screenshot_dir]
With no URL (or "-") the script serves dist/ on a free port itself. The demo
build (dist-demo/) is always served on its own free port for the demo
screenshots and the photo AI flow with a fake window.claude runtime.
Requires: pip install playwright && python -m playwright install chromium
"""
import functools, http.server, json, os, sys, re, tempfile, threading
from playwright.sync_api import sync_playwright, expect

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def serve(directory):
    """Serves a folder on a free localhost port in a background thread."""
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass
    handler = functools.partial(Quiet, directory=directory)
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f'http://127.0.0.1:{httpd.server_address[1]}/index.html'


SERVERS = []
if len(sys.argv) > 1 and sys.argv[1] != '-':
    URL = sys.argv[1]
else:
    _h, URL = serve(os.path.join(ROOT, 'dist')); SERVERS.append(_h)
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tempfile.gettempdir(), 'app-shots')
DEMO_SHOTS = sys.argv[3] if len(sys.argv) > 3 else SHOTS
os.makedirs(DEMO_SHOTS, exist_ok=True)
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

def scroll_to(page, locator, offset=8):
    locator.first.evaluate(f"el => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - {offset})")
    page.wait_for_timeout(200)


def demo_shot(page, name, top=None):
    try:
        page.locator('.toast').wait_for(state='detached', timeout=4000)
    except Exception:
        pass
    page.evaluate('document.activeElement && document.activeElement.blur()')
    if top is not None:
        scroll_to(page, top)
    else:
        page.evaluate('window.scrollTo(0,0)')
        page.wait_for_timeout(150)
    page.screenshot(path=f'{DEMO_SHOTS}/{name}.png')


def demo_page(ctx):
    """Demo build: household members, sample feedings, switch plan, spending shots."""
    page = ctx.new_page()
    page.on('console', log_console)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    page.goto(DEMO)
    feed = page.locator('.feed-card')
    expect(feed.get_by_text('Bailey was fed at 7:40 AM by Sarah')).to_be_visible()
    expect(feed.get_by_role('group', name='Who is feeding').get_by_role('button', name='Alex')).to_be_visible()
    feed.get_by_role('button', name='Alex').click()
    feed.get_by_role('button', name='Mark Breakfast fed for Luna').click()
    expect(feed.get_by_text(re.compile('Luna was fed at .* by Alex'))).to_be_visible()
    demo_shot(page, 'x-home-feedings', page.get_by_role('heading', name='Your pets'))
    # switch plan on Bailey
    page.goto(DEMO + '#/pets/sample-pet-bailey')
    food = page.locator('.food-card')
    food.get_by_role('button', name='Switch to a new food').click()
    dlg = page.get_by_role('dialog')
    dlg.get_by_role('radio', name='Add a new food').click()
    dlg.get_by_label('Brand').fill('Sample Ocean Kitchen')
    dlg.get_by_label('Food name').fill('Salmon and rice (sample)')
    dlg.get_by_role('button', name='Start plan').click()
    expect(food.get_by_text("Today's mix: 1.5 cups old + 0.5 cups new per feeding")).to_be_visible()
    for _ in range(4):
        food.get_by_role('button', name='One more Salmon training bites (sample)').click()
    expect(food.get_by_text('16 of about 130 kcal')).to_be_visible()
    demo_shot(page, 'x-food-switch-plan', food)
    page.evaluate("window.scrollBy(0, 560)")
    page.wait_for_timeout(150)
    page.screenshot(path=f'{DEMO_SHOTS}/x-food-treats.png')
    # spending
    page.goto(DEMO + '#/spending')
    expect(page.get_by_test_id('month-total')).to_be_visible()
    demo_shot(page, 'x-spending')
    scroll_to(page, page.get_by_role('heading', name='Last 6 months'), 80)
    page.screenshot(path=f'{DEMO_SHOTS}/x-spending-trend.png')
    page.close()


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
    # sample food lands at reorder soon and shows on Home
    expect(page.get_by_role('heading', name='Food', exact=True)).to_be_visible()
    expect(page.get_by_text("Bailey's food runs out in about 5 days")).to_be_visible()
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

    # food and treats: add a food, check the live estimate, log a new bag, reload
    food = page.locator('.food-card')
    food.get_by_role('button', name=re.compile('Add food or treat')).click()
    dlg = page.get_by_role('dialog')
    dlg.get_by_label('Brand').fill('Test Kibble Co')
    dlg.get_by_label('Food name').fill('Adult dry food')
    dlg.get_by_label('Bag size').fill('30')
    dlg.get_by_role('button', name='2 weeks ago').click()
    dlg.get_by_label('Per feeding').fill('1.5')
    expect(dlg.get_by_label('Cups per pound')).to_have_value('4')
    expect(dlg.get_by_text('At 1.5 cups twice a day, a 30 lb bag lasts about 40 days')).to_be_visible()
    dlg.get_by_role('button', name=re.compile('More: Feedings per day')).click()
    expect(dlg.get_by_text(re.compile('At 1.5 cups 3 times a day, a 30 lb bag lasts about 27 days'))).to_be_visible()
    dlg.get_by_role('button', name=re.compile('Fewer: Feedings per day')).click()
    # mismatched units ask the user to pick matching ones
    dlg.get_by_role('button', name='cups', exact=True).click()
    page.get_by_role('listbox', name='Portion unit').get_by_role('option', name='cans').click()
    expect(dlg.get_by_text(re.compile('do not convert'))).to_be_visible()
    dlg.get_by_role('button', name='cans', exact=True).click()
    page.get_by_role('listbox', name='Portion unit').get_by_role('option', name='cups').click()
    dlg.get_by_role('button', name='Save', exact=True).click()
    expect(food.get_by_text(re.compile(r'About \d+ lb left of 30 lb, runs out around'))).to_be_visible()
    expect(food.get_by_text('Plenty')).to_be_visible()
    assert food.get_by_role('link', name=re.compile('Reorder from')).count() == 0
    food.get_by_role('button', name='I bought a new bag').click()
    expect(food.get_by_text(re.compile('About 30 lb left of 30 lb'))).to_be_visible()
    page.reload()
    food = page.locator('.food-card')
    expect(food.get_by_text(re.compile('About 30 lb left of 30 lb'))).to_be_visible()
    expect(food.get_by_text('Your last bags lasted about 14 days')).to_be_visible()
    # a favorite treat with no tracking
    food.get_by_role('button', name=re.compile('Add food or treat')).click()
    dlg = page.get_by_role('dialog')
    dlg.get_by_role('radio', name='Treat').click()
    dlg.get_by_label('Brand').fill('Test Treats')
    dlg.get_by_label('Treat name').fill('Duck chews')
    dlg.get_by_role('button', name='Save', exact=True).click()
    expect(food.get_by_role('button', name=re.compile('Edit treat Duck chews'))).to_be_visible()
    shot(page, 'pet-food', False)

    # mark vaccine done flow is on sample pet; take pet detail shot on Bailey
    page.goto(URL + '#/pets/sample-pet-bailey')
    page.get_by_role('heading', name='Bailey').wait_for()
    expect(page.get_by_text('Reorder soon').first).to_be_visible()
    expect(page.get_by_role('link', name=re.compile('Reorder from'))).to_have_attribute('href', 'https://healthextension.com')
    shot(page, 'pet-detail', False)
    shot(page, 'pet-detail-full', True)

    # SET A: feeding check-off (sample breakfast is done), persists after reload, undo
    food = page.locator('.food-card')
    expect(food.get_by_text('Bailey was fed at 7:40 AM')).to_be_visible()
    expect(food.get_by_role('button', name='Undo Breakfast for Bailey')).to_be_visible()
    food.get_by_role('button', name='Mark Dinner fed for Bailey').click()
    expect(food.get_by_role('button', name='Undo Dinner for Bailey')).to_be_visible()
    page.reload()
    food = page.locator('.food-card')
    expect(food.get_by_role('button', name='Undo Dinner for Bailey')).to_be_visible()
    food.get_by_role('button', name='Undo Dinner for Bailey').click()
    expect(food.get_by_role('button', name='Mark Dinner fed for Bailey')).to_be_visible()
    # treat budget: sample target 1300 kcal, sample bites 4 kcal each
    expect(food.get_by_text('Sample values')).to_be_visible()
    meter = food.get_by_role('meter', name=re.compile('Treat calories today'))
    expect(meter).to_have_attribute('aria-valuenow', '0')
    for _ in range(3):
        food.get_by_role('button', name='One more Salmon training bites (sample)').click()
    expect(meter).to_have_attribute('aria-valuenow', '12')
    expect(food.get_by_text('12 of about 130 kcal')).to_be_visible()
    food.get_by_role('button', name='One less Salmon training bites (sample)').click()
    expect(meter).to_have_attribute('aria-valuenow', '8')
    page.reload()
    expect(page.locator('.food-card').get_by_role('meter', name=re.compile('Treat calories today'))).to_have_attribute('aria-valuenow', '8')
    # food switch plan
    food = page.locator('.food-card')
    food.get_by_role('button', name='Switch to a new food').click()
    dlg = page.get_by_role('dialog')
    dlg.get_by_role('radio', name='Add a new food').click()
    dlg.get_by_label('Brand').fill('Test Salmon Co')
    dlg.get_by_label('Food name').fill('Salmon kibble')
    expect(dlg.get_by_role('radio', name=re.compile('7 days'))).to_have_attribute('aria-checked', 'true')
    expect(dlg.get_by_text('Days 1 to 2')).to_be_visible()
    dlg.get_by_role('button', name='Start plan').click()
    expect(food.get_by_text("Today's mix: 1.5 cups old + 0.5 cups new per feeding")).to_be_visible()
    expect(food.get_by_text('Day 1 of 7')).to_be_visible()
    expect(food.get_by_text('Slow down if you see an upset stomach and ask your vet.')).to_be_visible()
    page.reload()
    expect(page.locator('.food-card').get_by_text("Today's mix: 1.5 cups old + 0.5 cups new per feeding")).to_be_visible()

    # SET A: household members and "fed by" from the Home card
    page.goto(URL + '#/account')
    page.get_by_label('Add a household member').fill('Sam')
    page.get_by_role('button', name='Add', exact=True).click()
    expect(page.get_by_role('button', name='Remove Sam', exact=True)).to_be_visible()
    expect(page.get_by_text('Sharing with family comes with accounts')).to_be_visible()
    page.goto(URL + '#/')
    feed = page.locator('.feed-card')
    expect(feed.get_by_role('heading', name="Today's feedings")).to_be_visible()
    feed.get_by_role('group', name='Who is feeding').get_by_role('button', name='Sam').click()
    feed.get_by_role('button', name='Mark Dinner fed for Bailey').click()
    expect(feed.get_by_text(re.compile(r'Bailey was fed at \d+:\d\d [AP]M by Sam'))).to_be_visible()

    # SET A: spending, add an expense and see the month total change
    page.goto(URL + '#/more')
    page.get_by_role('link', name=re.compile('Spending')).click()
    expect(page.get_by_role('heading', name='Spending')).to_be_visible()
    money = lambda: float(page.get_by_test_id('month-total').inner_text().replace('$', '').replace(',', ''))
    before = money()
    assert before > 0, before  # sample expenses this month
    page.get_by_role('button', name='Add expense').click()
    dlg = page.get_by_role('dialog')
    dlg.get_by_role('button', name='Vet', exact=True).click()
    dlg.get_by_label('Amount ($)').fill('45.25')
    dlg.get_by_label('Note (optional)').fill('Ear check')
    dlg.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_text('Ear check')).to_be_visible()
    assert abs(money() - (before + 45.25)) < 0.001, (before, money())
    expect(page.get_by_role('heading', name='Last 6 months')).to_be_visible()
    expect(page.get_by_role('heading', name='Average monthly cost per pet')).to_be_visible()
    page.get_by_role('button', name='Previous month').click()
    expect(page.get_by_role('button', name='Next month')).to_be_visible()
    with page.expect_download() as d:
        page.get_by_role('button', name='Export spending (CSV)').click()
    d.value.save_as(os.path.join(DL, 'spending.csv'))
    assert 'Ear check' in open(os.path.join(DL, 'spending.csv')).read()
    page.reload()
    expect(page.get_by_text('Ear check')).to_be_visible()
    page.goto(URL + '#/pets/sample-pet-bailey')
    page.get_by_role('heading', name='Bailey').wait_for()
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
    for r in ['#/care', '#/shop', '#/spending', '#/more', '#/notifications', '#/account', '#/explore/sample-place-riverside', '#/nope', '#/pets/missing', '#/travel/missing', '#/explore/missing']:
        page.goto(URL + r)
        page.wait_for_timeout(150)
        page.screenshot(path=f'{SHOTS}/route-{r.strip("#/").replace("/", "_") or "home"}.png')
    page.goto(URL + '#/notifications')
    expect(page.get_by_text(re.compile('Lake weekend starts'))).to_be_visible()
    expect(page.get_by_text("Bailey's food runs out in about 5 days")).to_be_visible()
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
    assert len(data['petFood']) == 7, len(data['petFood'])
    assert len(data['feedingLogs']) >= 2 and len(data['switchPlans']) == 1 and any(e.get('note') == 'Ear check' for e in data['expenses'])
    with page.expect_download() as d:
        page.get_by_role('button', name='Export food and treats (CSV)').click()
    d.value.save_as(os.path.join(DL, 'food.csv'))
    assert 'Test Kibble Co' in open(os.path.join(DL, 'food.csv')).read()

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
    page.goto(mochi_url)
    expect(page.locator('.food-card').get_by_text('Test Kibble Co')).to_be_visible()

    # 360 width check: no horizontal scroll
    page.set_viewport_size({'width': 360, 'height': 780})
    for r in ['#/', '#/explore', '#/pets/sample-pet-bailey', '#/pets/sample-pet-luna', trip_url.split('#')[1] and '#' + trip_url.split('#')[1], '#/boxes/build', '#/events', '#/account', '#/spending']:
        page.goto(URL + r); page.wait_for_timeout(120)
        sw = page.evaluate('document.documentElement.scrollWidth')
        if sw > 360: errors.append(f'horizontal overflow {sw}px on {r}')
    # tap targets in tabbar
    sizes = page.evaluate("[...document.querySelectorAll('.tab')].map(e=>e.getBoundingClientRect().height)")
    assert all(s >= 44 for s in sizes), sizes
    page.goto(URL + '#/pets/sample-pet-bailey'); page.wait_for_timeout(120)
    food_sizes = page.evaluate("[...document.querySelectorAll('.food-card button, .food-card a')].map(e=>e.getBoundingClientRect().height)")
    assert food_sizes and all(s >= 44 for s in food_sizes), food_sizes

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

    # ---------- demo build at 390x844, device scale 1 ----------
    dh, DEMO = serve(os.path.join(ROOT, 'dist-demo')); SERVERS.append(dh)
    demo = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    demo_page(demo)
    b.close()

ignore = ('fonts.googleapis', 'fonts.gstatic', 'ERR_TUNNEL', 'ERR_CONNECTION', 'net::', 'Failed to load resource')
real = [e for e in errors if not any(i in e for i in ignore)]
print('ALL CONSOLE:', *errors, sep='\n  ')
print('REAL ERRORS:', real)
print('OK' if not real else 'FAIL')
for h in SERVERS:
    h.shutdown()
