import asyncio

from PIL import Image

from cmfkit.apps.base import AppRunner
from cmfkit.apps.examples.checklist import Checklist
from cmfkit.session import AuthError, Session
from cmfkit.transport.sim import SimWatch
from cmfkit.watchface import photo


async def _paired():
    watch = SimWatch()
    await watch.connect()
    s = Session(watch, timeout=2)
    key = await s.pair()
    return watch, s, key


async def test_pair_then_query():
    watch, s, _ = await _paired()
    assert await s.firmware_version() == "1.0.0.77"
    assert await s.battery() == (87, False)
    assert await s.serial_number() == watch.serial


async def test_reconnect_with_stored_key():
    watch, _, key = await _paired()
    await watch.connect()
    s2 = Session(watch, timeout=2)
    await s2.login(key)
    await s2.notify("Hi", "again")
    await asyncio.sleep(0.05)
    assert watch.state.notifications == [("Hi", "again")]


async def test_wrong_secret_fails():
    watch = SimWatch()
    await watch.connect()
    s = Session(watch, timeout=0.5)
    try:
        await s.pair(secret=b"\x00" * 16)
    except (AuthError, TimeoutError):
        return
    raise AssertionError("pairing with a wrong secret should fail")


async def test_photo_dial_upload():
    watch, s, _ = await _paired()
    blob = photo.build(Image.new("RGB", (500, 500), (255, 0, 0)))
    assert await s.upload_photo_dial(blob)
    dial = watch.state.active_dial
    assert dial is not None and dial.full.size == (466, 466) and dial.thumb.size == (270, 270)
    assert dial.full.getpixel((233, 233)) == (248, 0, 0)  # RGB565 quantised red
    assert dial.full.getpixel((0, 0)) == (0, 0, 0)  # outside the round mask


async def test_app_receives_watch_buttons():
    watch, s, _ = await _paired()
    runner = AppRunner(s, Checklist, [])
    task = asyncio.create_task(runner.run(duration=1.0))
    await asyncio.sleep(0.1)
    watch.press("play")
    await asyncio.sleep(0.1)
    watch.press("next")
    await asyncio.sleep(0.1)
    runner.app.exit()
    await task
    assert watch.state.contacts[0].name == "[x] Passport"
    assert watch.state.music[0] == "Charger"
