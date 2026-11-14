#!/usr/bin/env python3
"""Write an explicitly provisional report from saved, grouped predictions."""
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, f1_score
from experiment_audited import OUT, ROOT, LABELS


def main():
    scores = pd.read_csv(OUT / 'macro_f1_by_split.csv')
    pred = pd.read_csv(OUT / 'predictions.csv.gz')
    gp = pd.read_csv(OUT / 'generalization_predictions.csv.gz')
    metrics = json.loads((OUT/'metrics.json').read_text(encoding='utf-8'))
    lines = ['# Предварительные результаты после аудита', '',
      '> Данные получены из исторического экспорта без времён отдельных отсчётов и без подтверждения инъекции. '
      'Результаты характеризуют только отфильтрованную выборку; минутный lookback rate() при этом отборе не учитывался. '
      'Для окончательной статьи требуется подтверждённый сбор.', '',
      '**MLP в таблицах и графиках ниже использует прежний фиксированный лимит итераций.** '
      'Оценка с выбором лимита на групповой validation приведена в [отдельном отчёте](MLP_VALIDATION_RESULTS.md).', '',
      '**Доли 50% и 75% округлялись вниз отдельно по сценарию:** фактическая доля прогонов ниже номинальной '
      'и зависит от числа прогонов в сценариях.', '',
      '## Основное сравнение', '',
      'Macro-F1: среднее по трём seed внутри каждого из пяти групповых разбиений, затем среднее ± стандартное отклонение между разбиениями.', '',
      '| Модель | 50% | 75% | 100% |', '|---|---:|---:|---:|']
    for model in ['rules','rf','mlp','transformer']:
        values=[]
        for fraction in [.5,.75,1.]:
            r=scores[(scores.model==model)&(scores.fraction==fraction)&(~scores.temporal)].iloc[0]
            values.append(f'{r["mean"]:.3f} ± {r["std"]:.3f}')
        lines.append(f'| {model} | '+ ' | '.join(values)+' |')
    lines += ['', '![Кривые обучения](audited_results/learning_curves.png)', '',
        'Размеры выражены в долях **обучающих прогонов** после отделения validation и test. '
        'Случайные разбиения могут пересекаться по прогонам, поэтому они не являются независимыми внешними наборами. '
        'Временной тест и все значения — в `audited_results/macro_f1_by_split.csv`.', '',
        '## Ошибки на тестовых окнах', '',
        'Указаны объединённые доли по 5 разбиениям × 3 seed на 100% train; окна и одни и те же прогоны могут встречаться многократно.', '',
        '| Модель | norm → attack | fault → attack | attack → fault | recall attack |', '|---|---:|---:|---:|---:|']
    for model in ['rules','rf','mlp','transformer']:
        p=pred[(pred.model==model)&(pred.fraction==1)&(~pred.temporal)]
        def rate(actual, predicted):
            s=p[p.truth==actual]; return (s.prediction==predicted).mean()
        lines.append(f'| {model} | {rate("norm","attack"):.3f} | {rate("fault","attack"):.3f} | {rate("attack","fault"):.3f} | {rate("attack","attack"):.3f} |')
    lines += ['', '## Невиданное семейство', '',
      'RF обучается без указанного семейства, тестируется на его атаках из отложенных прогонов пяти разбиений. '
      'Подсчёт по окнам; он не превращает коррелированные окна в независимые наблюдения.', '',
      '| Исключённое семейство | Окон с повторами между разбиениями | Доля, распознанная как атака |', '|---|---:|---:|']
    for family in ['brute_family','flood_family']:
        g=gp[(gp.kind=='holdout')&(gp.group==family)]
        lines.append(f'| {family} | {len(g)} | {(g.prediction==2).mean():.3f} |')
    lines += ['', '## Абляция метрик для RF', '',
              'Macro-F1 без отдельных семейств признаков: среднее ± std по пяти групповым разбиениям.', '',
              '| Исключено | Macro-F1 |', '|---|---:|']
    ablation = gp[gp.kind=='ablation']
    for group in ['none','network','database']:
        values=[]
        for _, subset in ablation[ablation.group==group].groupby('split'):
            values.append(f1_score(subset.truth, subset.prediction, labels=[0,1,2], average='macro', zero_division=0))
        lines.append(f'| {group} | {np.mean(values):.3f} ± {np.std(values, ddof=1):.3f} |')
    lines += ['', 'Состав групп, предсказания и оценки для отдельных сценариев доступны в `audited_results/generalization_predictions.csv.gz`. '
      'Оценки recall с равным весом прогонов и условные bootstrap-интервалы — в `audited_results/holdout_run_bootstrap.csv`; '
      'они отличаются от долей по окнам и не являются внешней оценкой на новых средах. '
      'Абляции сети и БД находятся там же (`kind=ablation`). Ошибки пар — в `pair_errors.csv`. '
      'Поля интенсивности и длительности выводятся раздельно в `attack_intensity.csv`; пустая частота означает, что журнал её не сохранил.', '',
      '## Матрицы ошибок', '',
      'Один зафиксированный тест: случайное разбиение 0, seed 0, 100% train; строки — истинный класс, столбцы — ответ модели.', '']
    fig,axes=plt.subplots(1,3,figsize=(11,3.5))
    for ax, model in zip(axes,['rf','mlp','transformer']):
        p=pred[(pred.model==model)&(pred.fraction==1)&(pred.split==0)&(pred.seed==0)&(~pred.temporal)]
        cm=confusion_matrix(p.truth,p.prediction,labels=LABELS)
        ax.imshow(cm,cmap='Blues'); ax.set_title(model); ax.set_xticks(range(3),LABELS,rotation=30); ax.set_yticks(range(3),LABELS)
        for i in range(3):
            for j in range(3): ax.text(j,i,str(cm[i,j]),ha='center',va='center',color='red' if cm[i,j] > cm.max()/2 else 'black')
    fig.tight_layout(); fig.savefig(OUT/'confusion_split0.png',dpi=160); plt.close(fig)
    lines += ['![Матрицы](audited_results/confusion_split0.png)', '',
      'Собранные модели отделяют некоторые известные сценарии почти идеально, но endpoint и нагрузка на БД дают короткий путь к ответу. '
      'Это не доказывает идентификацию намерения и не гарантирует перенос на реальные инциденты. '
      'Доверительные оценки и артефакты обусловлены ограниченным набором прогонов.', '',
      'Время обучения и инференса для каждой конфигурации сохранено в `metrics.json` (`train_seconds`, `inference_seconds`); '
      'значения включают разные шаги подготовки и измерены на текущем CPU. Часть замеров выполнялась параллельно с анализом обобщения; '
      'поэтому это диагностические оценки, а не корректный бенчмарк производительности.', '',
      'Старый 30-секундный vs 180-секундный эксперимент — в [RESULTS.md](RESULTS.md), но его выводы устарели.']
    (ROOT/'ml'/'AUDITED_RESULTS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print('AUDITED_RESULTS.md and confusion_split0.png written')


if __name__ == '__main__': main()
